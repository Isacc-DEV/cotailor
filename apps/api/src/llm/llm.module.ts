import { Global, Module, Logger } from '@nestjs/common';
import { LLM_PROVIDER } from './llm-provider.interface';
import { StubLlmProvider } from './stub.provider';
import { GeminiProvider } from './gemini.provider';
import { OpenAiProvider } from './openai.provider';

// Global so any service can inject LLM_PROVIDER. The active provider is chosen by
// the LLM_PROVIDER env var (stub | gemini | openai). BYO per-user keys (from the
// Settings DB) will layer on top later; for now each provider reads its key from
// env (GEMINI_API_KEY / OPENAI_API_KEY).
@Global()
@Module({
  providers: [
    StubLlmProvider,
    GeminiProvider,
    OpenAiProvider,
    {
      provide: LLM_PROVIDER,
      inject: [StubLlmProvider, GeminiProvider, OpenAiProvider],
      useFactory: (stub: StubLlmProvider, gemini: GeminiProvider, openai: OpenAiProvider) => {
        const choice = (process.env.LLM_PROVIDER ?? 'stub').trim().toLowerCase();
        const logger = new Logger('LlmModule');
        if (!['stub', 'gemini', 'openai'].includes(choice)) {
          logger.warn(`Unknown LLM_PROVIDER "${choice}" — valid values: stub | gemini | openai. Falling back to stub.`);
        }
        if (choice === 'gemini') {
          if (process.env.GEMINI_API_KEY) {
            logger.log('Using Gemini provider.');
            return gemini;
          }
          logger.warn('LLM_PROVIDER=gemini but GEMINI_API_KEY is empty; falling back to stub.');
          return stub;
        }
        if (choice === 'openai') {
          if (process.env.OPENAI_API_KEY) {
            logger.log(`Using OpenAI provider (model: ${process.env.OPENAI_MODEL ?? 'gpt-4o-mini'}).`);
            return openai;
          }
          logger.warn('LLM_PROVIDER=openai but OPENAI_API_KEY is empty; falling back to stub.');
          return stub;
        }
        logger.log('Using stub provider.');
        return stub;
      },
    },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
