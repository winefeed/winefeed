import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to dashboard (eller login om ej inloggad)
  redirect('/dashboard/new-request');
}
