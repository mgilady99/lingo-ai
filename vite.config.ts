import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // מעלה את רף האזהרה ל-1000KB (במקום 500KB)
    // זה יעלים את האזהרה בגלל שהקובץ שלנו הוא רק 505KB
    chunkSizeWarningLimit: 1000, 
  },
});
