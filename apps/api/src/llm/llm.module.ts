import { Global, Module } from '@nestjs/common';
import { LLM_PROVIDER } from './llm-provider.interface';
import { StubLlmProvider } from './stub.provider';

// Global so any service can inject LLM_PROVIDER. Default binding is the StubProvider;
// swap useClass for a real Claude/OpenAI/Gemini adapter (or select by env LLM_PROVIDER).
@Global()
@Module({
  providers: [{ provide: LLM_PROVIDER, useClass: StubLlmProvider }],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
