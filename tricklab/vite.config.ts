import { defineConfig } from 'vite';

// The lab imports the pose engine straight from the app source
// (../src/components/companion/*), so allow Vite to read the parent repo.
export default defineConfig({
  server: {
    fs: { allow: ['..'] },
    host: true,
  },
});
