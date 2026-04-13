import { build } from 'vite';

async function main() {
  try {
    await build({
      root: '/data/disk/projects/Project-Manager-Bot/SourceCode/frontend',
      configFile: '/data/disk/projects/Project-Manager-Bot/SourceCode/frontend/vite.config.ts'
    });
    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

main();