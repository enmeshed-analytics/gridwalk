"use server";
import { cookies } from "next/headers";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  auth: {
    user: process.env.NODEMAILER_USER,
    pass: process.env.NODEMAILER_PASS,
  },
});

async function sendWelcomeEmail(email: string, firstName: string) {
  await transporter.sendMail({
    from: "hello@enmeshed.dev",
    to: email,
    subject: "GridWalk Registration",
    html: `
     <!DOCTYPE html>
     <html>
       <head>
         <style>
           body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
           .container { max-width: 600px; margin: 0 auto; padding: 20px; }
           .header { background-color: #4F46E5; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
           .content { background-color: #ffffff; padding: 30px; border-radius: 0 0 8px 8px; }
           .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
           .button {
             background-color: #4F46E5;
             color: white;
             padding: 12px 25px;
             text-decoration: none;
             border-radius: 5px;
             display: inline-block;
             margin: 20px 0;
           }
         </style>
       </head>
       <body>
         <div class="container">
           <div class="header">
             <h1>Welcome to GridWalk! 🚀</h1>
           </div>
           <div class="content">
             <h2>Hi ${firstName},</h2>
             <p>Welcome aboard! We're thrilled to have you join the GridWalk community.</p>
             <p>If you have any questions, feel free to reach out to our support team at <a href="mailto:hello@enmeshed.dev">hello@enmeshed.dev</a>.</p>
             <p>Best regards,<br>The GridWalk Team</p>
           </div>
           <div class="footer">
             <p>© 2024 GridWalk by Enmeshed. All rights reserved.</p>
             <p>You're receiving this email because you signed up for a GridWalk account.</p>
           </div>
         </div>
       </body>
     </html>
   `,
  });
}

interface LoginResponse {
  apiKey: string;
  error?: string;
}

export async function loginAction(formData: {
  email: string;
  password: string;
}) {
  const response = await fetch(`${process.env.GRIDWALK_API}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });

  if (!response.ok) {
    const res = await response.text();
    throw new Error(res || "Login failed");
  }

  const data: LoginResponse = await response.json();
  // Set the cookie
  const cookieStore = await cookies();
  cookieStore.set({
    name: "sid",
    value: data.apiKey,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    httpOnly: false,
    sameSite: "lax",
  });
}

export async function registerAction(formData: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}) {
  try {
    const response = await fetch(`${process.env.GRIDWALK_API}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Registration failed");
    }

    // Send welcome email
    await sendWelcomeEmail(formData.email, formData.first_name);

    // After successful registration and email, log the user in
    return await loginAction({
      email: formData.email,
      password: formData.password,
    });
  } catch (error) {
    console.error("Registration error:", error);
    throw error;
  }
}
