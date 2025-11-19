// server/ai/ask-file.ts
//
// Tiny helper that answers questions about a *single* file.
// For now this is a stub that you can later swap to a real model call.

export type AskFileUser = {
  id?: string | number;
  email?: string | null;
  plan?: string | null;
};

export type AskFileQuestionInput = {
  filePath: string;
  fileContent: string;
  question: string;
  user?: AskFileUser;
};

export type AskFileQuestionResult = {
  answer: string;
  source: {
    path: string;
    chars: number;
  };
};

export async function askFileQuestion(
  input: AskFileQuestionInput,
): Promise<AskFileQuestionResult> {
  const { filePath, fileContent, question } = input;

  const trimmed = fileContent.trim();
  const charCount = fileContent.length;

  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  const lineCount = lines.length;

  const safePath = filePath || "(unknown file)";
  const safeQuestion = question?.trim() || "";

  const summaryBits: string[] = [];

  summaryBits.push(`You're asking about "${safePath}".`);

  if (charCount === 0) {
    summaryBits.push(
      `The file is currently empty (0 characters). There isn't much to analyse yet.`,
    );
  } else {
    summaryBits.push(
      `The file has about ${charCount} characters across ${lineCount} line(s).`,
    );
  }

  if (safeQuestion) {
    summaryBits.push(`Question: ${safeQuestion}`);
  } else {
    summaryBits.push(
      `No specific question was provided, so this is a high-level summary stub.`,
    );
  }

  summaryBits.push(
    `This is a stub response from askFileQuestion(). Later you can wire this to your real AI model.`,
  );

  const answer = summaryBits.join(" ");

  return {
    answer,
    source: {
      path: safePath,
      chars: charCount,
    },
  };
}
