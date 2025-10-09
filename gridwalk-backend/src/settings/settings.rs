use serde::{Deserialize, Serialize};
use sqlx::Row;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistrationApprovalSettings {
    pub require_approval: bool,
}

impl Default for RegistrationApprovalSettings {
    fn default() -> Self {
        Self {
            require_approval: false,
        }
    }
}

impl RegistrationApprovalSettings {
    const SETTINGS_KEY: &'static str = "registration_approval";

    pub async fn load(pool: &sqlx::PgPool) -> Result<Self, sqlx::Error> {
        let row = sqlx::query("SELECT value FROM gridwalk.app_settings WHERE key = $1")
            .bind(Self::SETTINGS_KEY)
            .fetch_optional(pool)
            .await?;

        match row {
            Some(row) => {
                let value: serde_json::Value = row.try_get("value")?;
                let settings: RegistrationApprovalSettings =
                    serde_json::from_value(value).map_err(|e| sqlx::Error::Decode(Box::new(e)))?;
                Ok(settings)
            }
            None => Ok(Self::default()),
        }
    }

    pub async fn save(&self, pool: &sqlx::PgPool) -> Result<(), sqlx::Error> {
        let value = serde_json::to_value(self).map_err(|e| sqlx::Error::Encode(Box::new(e)))?;

        sqlx::query(
            "INSERT INTO gridwalk.app_settings (key, value) VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        )
        .bind(Self::SETTINGS_KEY)
        .bind(value)
        .execute(pool)
        .await?;

        Ok(())
    }
}
