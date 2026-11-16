import './presentation/styles.css';
import { bootstrapApp } from './app/bootstrap.ts';

bootstrapApp().catch((err) => {
  console.error('Failed to bootstrap Twitch Clicker:', err);
});
