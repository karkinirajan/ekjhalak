import { NextRequest, NextResponse } from "next/server";
import {
  isAzureTranslatorConfigured,
  translateWithAzure,
} from "@/lib/azure-translator";

type RequestBody = {
  text?: string;
  from?: string;
  to?: string | string[];
};

export async function POST(request: NextRequest) {
  try {
    if (!isAzureTranslatorConfigured()) {
      return NextResponse.json(
        { error: "Missing AZURE_TRANSLATOR_KEY" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as RequestBody;
    if (!body.text?.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (!body.to || (Array.isArray(body.to) && body.to.length === 0)) {
      return NextResponse.json(
        { error: "Target language is required" },
        { status: 400 },
      );
    }

    const result = await translateWithAzure({
      text: body.text,
      from: body.from,
      to: body.to,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Azure translation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
