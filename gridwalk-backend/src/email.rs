use chrono::Datelike;
use handlebars::Handlebars;
use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};
use serde_json::json;
use std::path::Path;
use tracing::error;

#[derive(Debug, Clone)]
pub struct EmailService {
    handlebars: Handlebars<'static>,
    smtp_transport: SmtpTransport,
    from_email: String,
    base_url: String,
}

#[derive(Debug, thiserror::Error)]
pub enum EmailError {
    #[error("Template error: {0}")]
    Template(#[from] handlebars::RenderError),
    #[error("SMTP error: {0}")]
    Smtp(#[from] lettre::error::Error),
    #[error("SMTP transport error: {0}")]
    SmtpTransport(#[from] lettre::transport::smtp::Error),
    #[error("Address parsing error: {0}")]
    Address(#[from] lettre::address::AddressError),
    #[error("Template registration error: {0}")]
    TemplateRegistration(#[from] handlebars::TemplateError),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub type EmailResult<T> = Result<T, EmailError>;

impl EmailService {
    pub fn new(
        smtp_host: &str,
        smtp_username: &str,
        smtp_password: &str,
        from_email: &str,
        templates_dir: &str,
        base_url: &str,
    ) -> EmailResult<Self> {
        // Setup SMTP transport
        let creds = Credentials::new(smtp_username.to_owned(), smtp_password.to_owned());
        let smtp_transport = SmtpTransport::relay(smtp_host)?.credentials(creds).build();

        // Setup Handlebars
        let mut handlebars = Handlebars::new();
        Self::register_templates(&mut handlebars, templates_dir)?;

        Ok(Self {
            handlebars,
            smtp_transport,
            from_email: from_email.to_owned(),
            base_url: base_url.to_owned(),
        })
    }

    fn register_templates(handlebars: &mut Handlebars, templates_dir: &str) -> EmailResult<()> {
        let template_path = Path::new(templates_dir);

        if !template_path.exists() {
            tracing::warn!(
                "Email templates directory does not exist: {}",
                templates_dir
            );
            return Ok(());
        }

        // Only register verification template for now
        let verification_template = template_path.join("verification.html");
        if verification_template.exists() {
            handlebars.register_template_file("verification", &verification_template)?;
            tracing::info!("Registered verification email template");
        } else {
            tracing::warn!(
                "Verification template file not found: {}",
                verification_template.display()
            );
        }

        // Register pending approval template
        let pending_approval_template = template_path.join("pending_approval.html");
        if pending_approval_template.exists() {
            handlebars.register_template_file("pending_approval", &pending_approval_template)?;
            tracing::info!("Registered pending approval email template");
        } else {
            tracing::warn!(
                "Pending approval template file not found: {}",
                pending_approval_template.display()
            );
        }

        Ok(())
    }

    pub fn generate_verification_url(&self, token: &str) -> String {
        format!("{}/verify/{}", self.base_url, token)
    }

    pub async fn send_verification_email(
        &self,
        user_email: &str,
        user_name: &str,
        verification_url: &str,
    ) -> EmailResult<()> {
        let data = json!({
            "app_name": "SilentLink",
            "user_name": user_name,
            "user_email": user_email,
            "verification_url": verification_url,
            "expiry_hours": 24,
            "year": chrono::Utc::now().year(),
            "company_name": "SilentLink", // Make configurable later
        });

        tracing::debug!("Sending verification email to {}", user_email);

        // Render the template
        let html_body = self.handlebars.render("verification", &data)?;

        // Create email message
        let email = Message::builder()
            .from(self.from_email.parse()?)
            .to(user_email.parse()?)
            .subject("Please verify your email address")
            .header(ContentType::TEXT_HTML)
            .body(html_body)?;

        // Send email
        self.smtp_transport.send(&email)?;

        tracing::info!("Verification email sent successfully to {}", user_email);
        Ok(())
    }

    pub async fn send_pending_approval_email(
        &self,
        user_email: &str,
        user_name: &str,
        admin_emails: Vec<String>,
    ) -> EmailResult<()> {
        let data = json!({
            "app_name": "SilentLink",
            "user_name": user_name,
            "user_email": user_email,
            "year": chrono::Utc::now().year(),
            "company_name": "SilentLink", // Make configurable later
        });

        tracing::debug!("Sending pending approval emails for user {}", user_email);

        // Render the template
        let html_body = self.handlebars.render("pending_approval", &data)?;

        // Send email to each admin
        for admin_email in admin_emails {
            let email = Message::builder()
                .from(self.from_email.parse()?)
                .to(admin_email.parse()?)
                .subject("New user registration pending approval")
                .header(ContentType::TEXT_HTML)
                .body(html_body.clone())?;

            // Send email
            self.smtp_transport.send(&email)?;
            tracing::debug!("Pending approval email sent to admin: {}", admin_email);
        }

        tracing::info!(
            "Pending approval emails sent successfully for user {}",
            user_email
        );
        Ok(())
    }
}
