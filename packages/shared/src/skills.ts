// Skill matching helpers (design Section 9). Pure, unit-testable, no I/O.
// Used to classify each JD skill against a profile's skills as
// exact / similar / missing, and to find a related bullet for placement.

// Groups of interchangeable / adjacent skills. Membership in the same group
// makes two skills "similar" (e.g. React ~ Vue, AWS ~ GCP). Maintained by hand,
// never LLM-invented. Extend freely.
export const SIMILAR_SKILL_GROUPS: string[][] = [
  ['react', 'vue', 'angular', 'svelte', 'preact', 'solid', 'next', 'nuxt'],
  ['aws', 'amazon web services', 'gcp', 'google cloud', 'google cloud platform', 'azure', 'microsoft azure'],
  ['postgresql', 'postgres', 'mysql', 'mariadb', 'sqlite', 'sql server', 'mssql', 'oracle'],
  ['mongodb', 'dynamodb', 'couchdb', 'cassandra', 'firestore'],
  ['docker', 'podman', 'containerd'],
  ['kubernetes', 'k8s', 'nomad', 'ecs', 'openshift'],
  ['redis', 'memcached', 'valkey'],
  ['rabbitmq', 'kafka', 'aws sqs', 'sqs', 'sns', 'nats', 'activemq'],
  ['javascript', 'typescript'],
  ['express', 'nestjs', 'koa', 'fastify', 'hapi'],
  ['django', 'flask', 'fastapi'],
  ['spring', 'spring boot'],
  ['terraform', 'pulumi', 'cloudformation', 'cdk'],
  ['github actions', 'gitlab ci', 'circleci', 'jenkins', 'travis ci', 'ci/cd'],
  ['rest', 'rest apis', 'graphql', 'grpc'],
  ['prometheus', 'grafana', 'datadog', 'new relic', 'elk stack', 'elasticsearch'],
  ['jest', 'mocha', 'vitest', 'jasmine', 'cypress', 'playwright'],
  // AI / ML era
  ['pinecone', 'chromadb', 'faiss', 'qdrant', 'weaviate', 'milvus', 'pgvector'],
  ['langchain', 'llamaindex', 'haystack', 'semantic kernel'],
  ['crewai', 'langgraph', 'autogen', 'openai agents sdk'],
  ['peft', 'lora', 'qlora'],
  ['mlflow', 'weights & biases', 'wandb', 'comet'],
  ['databricks', 'sagemaker', 'aws sagemaker', 'vertex ai'],
  ['tensorflow', 'pytorch', 'keras', 'jax'],
  ['pandas', 'polars', 'dask'],
  ['spark', 'pyspark', 'hadoop', 'flink'],
  ['github', 'gitlab', 'bitbucket'],
  ['openai api', 'anthropic api', 'gemini api', 'llm apis', 'llms'],
];

// Pure umbrella/category words that are not themselves demonstrable skills.
// Extraction is told to expand these into concrete items; this is the
// deterministic backstop so a stray "APIs" or "Cloud" never becomes a card.
const GENERIC_SKILL_TERMS = new Set([
  'api',
  'apis',
  'rest api',
  'cloud',
  'cloud infrastructure',
  'database',
  'databases',
  'vector databases',
  'vector database',
  'llm frameworks',
  'ml frameworks',
  'frameworks',
  'framework',
  'libraries',
  'library',
  'tools',
  'tooling',
  'software',
  'technology',
  'technologies',
  'platforms',
  'platform',
  'systems',
  'internal tools',
  'data platforms',
  'containerization',
  'version control',
  'programming',
  'coding',
  'scripting',
]);

/** True when a keyword is a concrete, demonstrable skill (not a bare umbrella term). */
export function isSpecificSkill(skill: string): boolean {
  return !GENERIC_SKILL_TERMS.has(norm(skill));
}

export type SkillClassification =
  | { match: 'exact'; profileSkill: string }
  | { match: 'similar'; profileSkill: string }
  | { match: 'missing' };

function norm(s: string): string {
  // Lowercase, trim, and strip a trailing ".js"/" js" so "Vue.js" == "Vue",
  // "Node.js" == "Node", "React JS" == "React".
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s.]+js$/, '');
}

function groupOf(skill: string): string[] | undefined {
  const n = norm(skill);
  return SIMILAR_SKILL_GROUPS.find((g) => g.includes(n));
}

/**
 * Classify one JD skill against the profile's skills.
 * - exact:   profile has the same skill
 * - similar: profile has a skill in the same group (returns that profile skill)
 * - missing: nothing close
 */
export function classifySkill(profileSkills: string[], jdSkill: string): SkillClassification {
  const jd = norm(jdSkill);

  const exact = profileSkills.find((p) => norm(p) === jd);
  if (exact) return { match: 'exact', profileSkill: exact };

  const group = groupOf(jdSkill);
  if (group) {
    const similar = profileSkills.find((p) => group.includes(norm(p)));
    if (similar) return { match: 'similar', profileSkill: similar };
  }

  return { match: 'missing' };
}

export interface BulletRef {
  experienceIndex: number;
  bulletIndex: number;
  text: string;
}

/**
 * Find an existing bullet relevant/exchangeable for a skill: a bullet whose
 * text or technologies contain the skill itself or a same-group skill.
 * Returns the first match, or null if none (→ caller adds a new bullet).
 */
export function findRelevantBullet(
  workExperience: Array<{ bullets?: string[]; technologies?: string[] }>,
  skill: string,
): BulletRef | null {
  const group = groupOf(skill) ?? [norm(skill)];

  for (let ei = 0; ei < workExperience.length; ei++) {
    const exp = workExperience[ei];
    const techHit = (exp.technologies || []).some((t) => group.includes(norm(t)));
    const bullets = exp.bullets || [];
    for (let bi = 0; bi < bullets.length; bi++) {
      const text = bullets[bi];
      const words = norm(text).split(/[^a-z0-9.+#]+/);
      if (techHit || group.some((g) => words.includes(g) || norm(text).includes(g))) {
        return { experienceIndex: ei, bulletIndex: bi, text };
      }
    }
    // A technology match with no bullets still signals relevance at job level.
    if (techHit && bullets.length === 0) {
      return { experienceIndex: ei, bulletIndex: -1, text: '' };
    }
  }
  return null;
}

// Broader "same ecosystem" clusters used ONLY for placing new bullets — a Docker
// job is a sensible home for a Kubernetes bullet even though the two are not
// exchangeable. Distinct from SIMILAR_SKILL_GROUPS, which drives exchange/both.
const PLACEMENT_CLUSTERS: string[][] = [
  // containers, orchestration, cloud & delivery
  ['docker', 'podman', 'containerd', 'kubernetes', 'k8s', 'helm', 'ecs', 'openshift', 'nomad',
   'terraform', 'pulumi', 'cloudformation', 'cdk', 'aws', 'gcp', 'azure',
   'ci/cd', 'github actions', 'gitlab ci', 'jenkins', 'circleci'],
  // data engineering & analytics
  ['sql', 'postgresql', 'postgres', 'mysql', 'pandas', 'polars', 'spark', 'pyspark', 'hadoop',
   'flink', 'etl', 'airflow', 'dbt', 'snowflake', 'bigquery', 'redshift', 'databricks', 'data pipelines'],
  // AI / LLM ecosystem
  ['langchain', 'llamaindex', 'haystack', 'rag', 'embeddings', 'embedding models',
   'pinecone', 'chromadb', 'faiss', 'qdrant', 'weaviate', 'milvus', 'pgvector',
   'llms', 'prompt engineering', 'fine-tuning', 'peft', 'lora', 'qlora',
   'mlflow', 'wandb', 'weights & biases', 'sagemaker', 'vertex ai',
   'pytorch', 'tensorflow', 'crewai', 'langgraph', 'autogen', 'mcp',
   'function calling', 'agentic workflows', 'multi-agent systems'],
  // backend web
  ['node', 'express', 'nestjs', 'fastify', 'koa', 'rest', 'rest apis', 'graphql', 'grpc',
   'fastapi', 'flask', 'django', 'spring', 'spring boot'],
  // frontend web
  ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt', 'typescript', 'javascript', 'html', 'css', 'tailwind'],
  // observability
  ['prometheus', 'grafana', 'datadog', 'new relic', 'elk stack', 'elasticsearch',
   'logging', 'observability', 'monitoring'],
];

function relatedTokensForSkill(skill: string): string[] {
  const n = norm(skill);
  const tokens = new Set<string>(groupOf(skill) ?? [n]);
  for (const cluster of PLACEMENT_CLUSTERS) {
    if (cluster.includes(n)) cluster.forEach((c) => tokens.add(c));
  }
  return [...tokens];
}

/**
 * Relevance of one work experience for placing a NEW bullet about `skill`:
 * +3 per technology in the skill's related set (similar-group + ecosystem
 * cluster), +1 per bullet/description mentioning a related token.
 * 0 = no signal (caller falls back to recency).
 */
export function scoreExperienceForSkill(
  exp: { bullets?: string[]; technologies?: string[]; description?: string },
  skill: string,
): number {
  const related = relatedTokensForSkill(skill);
  let score = 0;
  for (const t of exp.technologies || []) {
    if (related.includes(norm(t))) score += 3;
  }
  const texts = [...(exp.bullets || []), exp.description || ''];
  for (const text of texts) {
    const n = norm(text);
    // Short tokens ("aws", "rest", "k8s") must match whole words to avoid
    // false hits inside other words ("restructured").
    const words = new Set(n.split(/[^a-z0-9.+#/&]+/));
    if (related.some((g) => (g.length <= 4 ? words.has(g) : n.includes(g)))) score += 1;
  }
  return score;
}
