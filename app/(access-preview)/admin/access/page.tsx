/**
 * VINKOLL ACCESS - Landing Page
 *
 * /admin/access
 *
 * Clean Vinkoll style with a warm bordeaux hero
 */

import Link from 'next/link';

export default function AccessLandingPage() {
  return (
    <div>
      {/* Hero — warm bordeaux with breathing room */}
      <section className="bg-[#722F37] text-white py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm uppercase tracking-widest text-white/60 mb-4">Vinkoll Access</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
            Hitta ditt drömvin via Vinkoll
          </h1>
          <p className="text-lg text-white/70 mb-10 max-w-xl mx-auto leading-relaxed">
            Upptäck viner som redan finns i Sverige — hos importörer,
            men utanför Systembolaget. Hitta, förfråga och köp direkt.
          </p>
          <Link
            href="/admin/access/viner"
            className="inline-block bg-white text-[#722F37] font-medium px-8 py-3 rounded-full hover:bg-white/90 transition-colors"
          >
            Utforska viner
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-16">
            Så här gör du
          </h2>
          <div className="grid md:grid-cols-3 gap-12">
            <StepCard
              number={1}
              title="Sök"
              description="Bläddra bland viner från utvalda producenter. Filtrera på typ, land eller druva."
            />
            <StepCard
              number={2}
              title="Förfråga"
              description="Hittade något intressant? Skicka en förfrågan till importören med önskat antal."
            />
            <StepCard
              number={3}
              title="Importören hanterar"
              description="Importören kontaktar dig med pris och leveransinformation. Du bestämmer."
            />
          </div>
        </div>
      </section>

      {/* Why — light warm background */}
      <section className="py-20 px-6 bg-[#722F37]/5">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Varför Vinkoll Access?
          </h2>
          <p className="text-gray-500 text-lg leading-relaxed">
            Svenska importörer har tusentals viner som aldrig når Systembolagets sortiment.
            Via Vinkoll Access kan du hitta dem, skicka en förfrågan och köpa direkt från importören.
            Ofta handlar det om mindre producenter i små volymer med exceptionell kvalitet till rimliga priser.
          </p>
          <Link
            href="/admin/access/viner"
            className="inline-block mt-10 bg-[#722F37] text-white font-medium px-6 py-3 rounded-full hover:bg-[#5a252c] transition-colors"
          >
            Utforska viner
          </Link>
        </div>
      </section>
    </div>
  );
}

function StepCard({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 rounded-full bg-[#722F37] text-white font-semibold text-sm flex items-center justify-center mx-auto mb-4">
        {number}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}
