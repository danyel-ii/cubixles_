import { NextResponse } from "next/server";

const PINATA_ENDPOINT = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

function getPinataJwt() {
  return process.env.PINATA_JWT;
}

export async function POST(request) {
  const jwt = getPinataJwt();
  if (!jwt) {
    return NextResponse.json({ error: "Missing PINATA_JWT" }, { status: 500 });
  }
  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid metadata payload" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid metadata payload" }, { status: 400 });
  }
  try {
    const response = await fetch(PINATA_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: text || "Pinata error" },
        { status: response.status }
      );
    }
    const data = await response.json();
    return NextResponse.json({
      ipfsHash: data.IpfsHash,
      uri: data.IpfsHash ? `ipfs://${data.IpfsHash}` : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Pinata request failed" },
      { status: 500 }
    );
  }
}
