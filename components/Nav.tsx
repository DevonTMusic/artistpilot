import Link from "next/link";
export default function Nav({ signedIn }: { signedIn?: boolean }) {
  const link = "text-zinc-300 hover:text-white";
  return (
    <header className="border-b border-zinc-800">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3">
        <Link href={signedIn ? "/home" : "/"} className="flex items-center gap-2 text-xl font-extrabold">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 text-sm">♪</span>ArtistPilot
        </Link>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm sm:text-base">
          {signedIn ? (<>
            <Link className={link} href="/home">Home</Link>
            <Link className={link} href="/academy">Academy</Link>
            <Link className={link} href="/studio">Studio</Link>
            <Link className={link} href="/dashboard">Idea Lab</Link>
            <Link className={link} href="/settings">Settings</Link>
            <form action="/auth/signout" method="post"><button className="text-zinc-400 hover:text-white">Log out</button></form>
          </>) : (<>
            <Link className={link} href="/#how">How it works</Link>
            <Link className={link} href="/#pricing">Pricing</Link>
            <Link className={link} href="/login">Log in</Link>
            <Link href="/signup" className="rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 px-4 py-2 font-bold text-white">Sign up</Link>
          </>)}
        </nav>
      </div>
    </header>
  );
}
