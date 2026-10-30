import Nav from "@/components/Nav";
import Studio from "@/components/Studio";
import { requireUser } from "@/lib/access";

export default async function StudioPage() {
  const { profile, isPro } = await requireUser();

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#121316] text-white">
      <header className="flex-none border-b border-[#3B3155] bg-[#18191d]">
        <Nav signedIn />
      </header>
      <main className="min-h-0 flex-1 w-full overflow-hidden">
        <Studio defaultBpm={profile?.default_bpm ?? 118} isPro={isPro} />
      </main>
    </div>
  );
}
