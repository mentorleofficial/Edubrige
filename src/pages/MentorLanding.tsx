import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useBranding } from "@/contexts/BrandingContext";
import MentorApplicationDialog from "@/components/MentorApplicationDialog";
import { Sparkles, Users, Calendar, Award, ArrowRight, ClipboardCheck, GraduationCap } from "lucide-react";

const benefits = [
  { icon: Sparkles, title: "Make Real Impact", desc: "Help mentees grow and shape the next generation of talent." },
  { icon: Calendar, title: "Flexible Schedule", desc: "Set your own availability and book sessions on your terms." },
  { icon: Users, title: "Expand Your Network", desc: "Meet ambitious people across industries and disciplines." },
  { icon: Award, title: "Recognition", desc: "Build your reputation as a trusted expert in your field." },
];

const steps = [
  { icon: ClipboardCheck, title: "Apply", desc: "Submit your details, links and resume in a quick form." },
  { icon: GraduationCap, title: "Review", desc: "Our admin team reviews and verifies your application." },
  { icon: Sparkles, title: "Onboard", desc: "Get approved, set availability, and start mentoring." },
];

const faqs = [
  { q: "Is there a cost to apply?", a: "No — applying is completely free." },
  { q: "How long does review take?", a: "Most applications are reviewed within 5–7 business days." },
  { q: "How much time do I need to commit?", a: "It's entirely up to you. Set your own availability." },
  { q: "What happens after approval?", a: "You'll receive an email invite to create your mentor account." },
];

const MentorLanding = () => {
  const branding = useBranding();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between py-4">
          <Link to="/" className="flex items-center gap-2">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt={branding.app_name} className="h-8 w-8 rounded" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground font-bold">M</div>
            )}
            <span className="font-semibold">{branding.app_name}</span>
          </Link>
          <Link to="/login">
            <Button variant="ghost">Sign in</Button>
          </Link>
        </div>
      </header>

      <section className="container mx-auto px-4 py-20 text-center">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3 w-3" /> Now accepting mentor applications
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Share your expertise. <br className="hidden sm:block" />
            <span className="text-primary">Mentor the next generation.</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Join {branding.app_name} as a mentor and guide ambitious learners. Set your schedule, share your knowledge,
            and grow your network — on your terms.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button size="lg" onClick={() => setOpen(true)} className="gap-2">
              Apply Now <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#how-it-works">How it works</a>
            </Button>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b) => (
            <Card key={b.title} className="border-2 hover:border-primary/40 transition-colors">
              <CardContent className="pt-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <b.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold sm:text-4xl">How it works</h2>
            <p className="text-muted-foreground mt-2">Three simple steps to get started.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            {steps.map((s, i) => (
              <div key={s.title} className="relative">
                <Card className="h-full">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                        {i + 1}
                      </div>
                      <s.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg">{s.title}</h3>
                    <p className="text-sm text-muted-foreground">{s.desc}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Button size="lg" onClick={() => setOpen(true)}>
              Start your application
            </Button>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-20 max-w-3xl">
        <h2 className="text-3xl font-bold text-center mb-10">Frequently asked questions</h2>
        <div className="space-y-4">
          {faqs.map((f) => (
            <Card key={f.q}>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-1">{f.q}</h3>
                <p className="text-sm text-muted-foreground">{f.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} {branding.app_name}
      </footer>

      <MentorApplicationDialog open={open} onOpenChange={setOpen} />
    </div>
  );
};

export default MentorLanding;
