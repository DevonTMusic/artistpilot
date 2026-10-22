import Nav from "@/components/Nav";
import Studio from "@/components/Studio";
import { requirePaid } from "@/lib/access";
export default async function StudioPage() {
  const { profile } = await requirePaid();
  return (<>
    <Nav signedIn />
    <main className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="text-3xl font-extrabold">Music Studio</h1>
      <p className="mb-8 mt-2 max-w-2xl text-zinc-400">Record as many tracks as you need, add a drum beat, set the mix, save your session to your own device and export your song. Use headphones so the backing tracks don't leak into your microphone.</p>
      <Studio defaultBpm={profile?.default_bpm ?? 92} />
    </main>
  </>);
}
