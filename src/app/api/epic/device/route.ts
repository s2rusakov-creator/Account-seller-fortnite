import { startDeviceAuth } from '@/lib/epic/client';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Starts a login and hands the seller the code to type at Epic. */
export async function POST() {
  try {
    const code = await startDeviceAuth();
    return NextResponse.json({
      userCode: code.userCode,
      deviceCode: code.deviceCode,
      verificationUri: code.verificationUri,
      verificationUriComplete: code.verificationUriComplete,
      expiresIn: code.expiresIn,
      interval: code.interval,
      client: code.client,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Epic недоступен' },
      { status: 502 },
    );
  }
}
