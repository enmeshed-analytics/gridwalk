import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
});

// Bucket Namme for remote file upload
// const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const BUCKET_NAME =
  "gridwalkinfrastructureprodgridwalkfbf71770-remote-file-bucket";

export async function POST(request: NextRequest) {
  console.log("API route hit");
  const { layerName, data } = await request.json();

  if (!layerName || !data) {
    return NextResponse.json(
      { message: "Missing required fields" },
      { status: 400 },
    );
  }

  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: `${layerName}`,
      Body: JSON.stringify(data),
      ContentType: "application/json",
    };
    const command = new PutObjectCommand(params);
    await s3Client.send(command);
    const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${layerName}`;

    return NextResponse.json(
      { message: "File uploaded successfully", url: fileUrl },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error uploading to S3:", error);
    return NextResponse.json(
      { message: "Error uploading file to S3" },
      { status: 500 },
    );
  }
}
