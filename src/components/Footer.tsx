import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="mt-16 bg-black text-white">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex flex-col gap-6 border-b border-white/15 pb-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-3xl font-bold uppercase leading-tight tracking-tight">Stay in the loop.</p>
            <p className="mt-2 max-w-md text-sm text-white/65">Get updates about new events, community moments, and announcements.</p>
          </div>
          <form className="flex w-full max-w-md overflow-hidden rounded-full bg-white p-1" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="footer-email" className="sr-only">Email address</label>
            <input id="footer-email" type="email" required placeholder="Your email address" className="min-w-0 flex-1 bg-transparent px-4 text-base text-[#071333] outline-none placeholder:text-[#071333]/50" />
            <button type="submit" aria-label="Subscribe to newsletter" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-flame text-lg font-bold text-white transition hover:brightness-110">↗</button>
          </form>
        </div>

        <div className="grid gap-10 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" className="text-xl font-bold">Uptown City Vibez</Link>
            <p className="mt-3 text-sm leading-relaxed text-white/60">Music, culture, community, and memorable experiences.</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">Useful links</h2>
            <div className="mt-4 space-y-2 text-sm text-white/60">
              <Link className="block hover:text-white" to="/all-events">All events</Link>
              <Link className="block hover:text-white" to="/membership">Membership</Link>
              <Link className="block hover:text-white" to="/login">Organizer login</Link>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">Contact us</h2>
            <div className="mt-4 space-y-2 text-sm text-white/60">
              <a className="block hover:text-white" href="mailto:hello@uptowncityvibe.com">hello@uptowncityvibe.com</a>
              <a className="block hover:text-white" href="tel:+233000000000">+233 00 000 0000</a>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">Our social</h2>
            <div className="mt-4 flex gap-4 text-sm text-white/60">
              <a href="#facebook" aria-label="Facebook" className="hover:text-white">f</a>
              <a href="#x" aria-label="X" className="hover:text-white">X</a>
              <a href="#instagram" aria-label="Instagram" className="hover:text-white">◎</a>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/15 pt-5 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Uptown City Vibez. All rights reserved.</span>
          <span>Community first. Always.</span>
        </div>
      </div>
    </footer>
  )
}
