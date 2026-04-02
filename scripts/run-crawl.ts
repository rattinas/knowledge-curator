import { getDb } from '../src/lib/db/index';
import { getActiveTopic } from '../src/lib/db/queries';
import { runPipeline } from '../src/lib/pipeline/crawl';

async function main() {
  const topic = process.argv[2];
  
  // Init DB
  getDb();
  
  const topics = getActiveTopic();
  
  if (topics.length === 0) {
    console.log('No active topics. Create one first via the UI.');
    process.exit(0);
  }

  const target = topic 
    ? topics.find(t => t.name.toLowerCase().includes(topic.toLowerCase()))
    : topics[0];

  if (!target) {
    console.log(`Topic "${topic}" not found. Available: ${topics.map(t => t.name).join(', ')}`);
    process.exit(1);
  }

  console.log(`\nStarting pipeline for: "${target.name}"`);
  console.log(`Keywords: ${target.keywords.join(', ')}\n`);

  const result = await runPipeline(target, (progress) => {
    console.log(`[${progress.step}] ${progress.message}`);
  });

  console.log('\nPipeline complete!', result);
}

main().catch(e => {
  console.error('Pipeline error:', e);
  process.exit(1);
});
