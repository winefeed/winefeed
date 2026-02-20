import Link from 'next/link';
import { Wine } from 'lucide-react';

export default function WineNotFound() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <Wine className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
      <h2 className="text-lg font-semibold text-foreground mb-2">Vinet hittades inte</h2>
      <Link href="/admin/access/viner" className="text-[#722F37] hover:underline">
        Tillbaka till viner
      </Link>
    </div>
  );
}
