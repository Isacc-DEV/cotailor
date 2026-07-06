import { Injectable, Logger } from '@nestjs/common';
import type {
  JdPrecheck,
  JdAnalysis,
  SkillExtraction,
  ResumeStrategy,
  ResumeContent,
  ResumeValidation,
  ProfileImport,
} from '@cotailor/shared';
import type { BulletRewriteInput, LLMProvider, SummaryInput } from './llm-provider.interface';
import { StubLlmProvider } from './stub.provider';
import {
  buildAnalyzeJDPrompt,
  buildExtractSkillsPrompt,
  buildParseResumePrompt,
  buildRewriteBulletPrompt,
  buildWriteSummaryPrompt,
} from './prompts';

// Real provider backed by OpenAI (REST chat completions, no SDK dependency).
// Mirrors GeminiProvider exactly: the same prompts (see prompts.ts), the same
// LLM-powered methods (analyzeJD, extractSkills, rewriteBullet, writeSummary),
// the same throw-on-failure policy so an API problem surfaces as an error —
// never as silently-wrong stub data. Selected via LLM_PROVIDER=openai.
// Reads OPENAI_API_KEY / OPENAI_MODEL from env for now; per-user keys (from the
// Settings DB) will replace the env lookup later.
@Injectable()
export class OpenAiProvider implements LLMProvider {
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly fallback = new StubLlmProvider();

  private get apiKey(): string {
    return process.env.OPENAI_API_KEY ?? '';
  }
  private get model(): string {
    return process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  }

  // Throws on any failure. Callers for AI-powered methods let it propagate.
  private async callJson<T>(prompt: string, temperature = 0.2): Promise<T> {
    if (!this.apiKey) throw new Error('OPENAI_API_KEY is not set');

    // Reasoning models (o1/o3/o4..., gpt-5 family) reject custom temperature —
    // omit it there and let the model default apply.
    const isReasoningModel = /^o\d/i.test(this.model) || /^gpt-5/i.test(this.model);
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      // All our prompts demand JSON and contain the word "JSON", which this
      // response format requires.
      response_format: { type: 'json_object' },
      // Same output cap as the Gemini provider (8192) so cost/length stay bounded.
      max_completion_tokens: 8192,
    };
    if (!isReasoningModel) body.temperature = temperature;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.text();
      this.logger.error(`OpenAI HTTP ${res.status}: ${errBody.slice(0, 300)}`);
      throw new Error(`OpenAI request failed (HTTP ${res.status}). Check OPENAI_MODEL/OPENAI_API_KEY.`);
    }
    const data: any = await res.json();
    const choice = data?.choices?.[0];
    const text: string = choice?.message?.content ?? '';
    if (choice?.finish_reason === 'length') {
      throw new Error('OpenAI response was cut off (length). Try a shorter job description.');
    }
    if (choice?.finish_reason === 'content_filter') {
      throw new Error('OpenAI filtered the response (content_filter). Try rewording the input.');
    }
    if (!text) throw new Error('OpenAI returned an empty response.');
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      this.logger.error(`OpenAI non-JSON response: ${cleaned.slice(0, 200)}`);
      throw new Error('OpenAI returned a response that was not valid JSON.');
    }
  }

  // Cheap heuristic — avoids a round-trip for the precheck gate.
  async precheckJD(jdText: string): Promise<JdPrecheck> {
    return this.fallback.precheckJD(jdText);
  }

  async analyzeJD(jdText: string): Promise<JdAnalysis> {
    return this.callJson<JdAnalysis>(buildAnalyzeJDPrompt(jdText), 0.1);
  }

  async extractSkills(jdText: string): Promise<SkillExtraction> {
    return this.callJson<SkillExtraction>(buildExtractSkillsPrompt(jdText), 0);
  }

  async rewriteBullet(input: BulletRewriteInput): Promise<{ text: string }> {
    const out = await this.callJson<{ text: string }>(buildRewriteBulletPrompt(input), 0.4);
    return { text: (out.text || '').trim() };
  }

  // Professional summary derived ONLY from the final tailored resume content.
  async writeSummary(input: SummaryInput): Promise<{ text: string }> {
    const out = await this.callJson<{ text: string }>(buildWriteSummaryPrompt(input), 0.4);
    return { text: (out.text || '').trim() };
  }

  async parseResumeToProfile(resumeText: string): Promise<ProfileImport> {
    return this.callJson<ProfileImport>(buildParseResumePrompt(resumeText), 0.1);
  }

  // Unused by the current flow — safe defaults.
  generateResumeStrategy(_input: unknown): Promise<ResumeStrategy> {
    return this.fallback.generateResumeStrategy();
  }
  generateResume(_input: unknown): Promise<ResumeContent> {
    return this.fallback.generateResume();
  }
  validateResume(_input: unknown): Promise<ResumeValidation> {
    return this.fallback.validateResume();
  }
  reviseResume(_input: unknown): Promise<ResumeContent> {
    return this.fallback.reviseResume();
  }
}
