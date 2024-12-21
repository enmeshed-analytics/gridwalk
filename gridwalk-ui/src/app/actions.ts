"use server";
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { headers } from "next/headers";
import nodemailer from "nodemailer";

// Initialise DynamoDB client
const client = new DynamoDB({
  region: process.env.AWS_REGION || "us-east-1",
});
const docClient = DynamoDBDocument.from(client);

export async function saveEmail(email: string) {
  "use server";

  try {
    // Get headers
    const headersList = await headers();

    // Get IP from X-Forwarded-For header
    // ALB adds the client's IP as the last address in the XFF chain
    const forwardedFor = headersList.get("x-forwarded-for");
    const clientIp = forwardedFor
      ? forwardedFor.split(",")[0].trim()
      : "unknown";

    const params = {
      TableName: process.env.DYNAMODB_LANDING_TABLE!,
      Item: {
        PK: uuidv4(),
        email: email,
        ip_address: clientIp,
        created_at: new Date().toISOString(),
      },
    };

    await docClient.put(params);
    return { success: true };
  } catch (error) {
    console.error("Error saving email:", error);
    return { success: false, error: "Failed to save email" };
  }
}

// Register Beta Interest Action
// TODO have this dump to a Google Sheets as well as email
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  auth: {
    user: process.env.NODEMAILER_USER,
    pass: process.env.NODEMAILER_PASS,
  },
});

export async function sendEmail(formData: FormData): Promise<void> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;

  try {
    if (!name || !email) {
      throw new Error("Please fill in all fields");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Please enter a valid email address");
    }

    await transporter.sendMail({
      from: process.env.NODEMAILER_USER,
      to: "chris@enmeshed.dev",
      replyTo: email,
      subject: `Private Beta Registration - GridWalk`,
      text: `
        New Private Beta Registration:
        
        Name: ${name}
        Email: ${email}
        Registration Date: ${new Date().toISOString()}

        User has registered interest in joining the GridWalk private beta program.
      `,
      html: `
        <h2>New Private Beta Registration</h2>
        <p>A new user has registered interest in joining the GridWalk private beta program.</p>
        
        <h3>Registration Details:</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Registration Date:</strong> ${new Date().toISOString()}</p>
      `,
    });
  } catch (error) {
    console.error("Email error:", error);
    throw error;
  }
}
