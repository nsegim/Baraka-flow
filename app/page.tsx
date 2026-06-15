import Link from "next/link"
import Image from "next/image"
import {
  Package, ShoppingCart, BarChart3,
  Truck, CheckCircle, ArrowRight,
  TrendingUp, Shield, Zap
} from "lucide-react"

// ─────────────────────────────────────────
// This is a SERVER COMPONENT — no "use client"
// It renders on the server and sends pure HTML
// Fastest possible loading — important for
// first impressions on slow Rwandan networks
// ─────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-baraka-cream">

      {/* ══════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════ */}
      <nav className="
        sticky top-0 z-50
        bg-baraka-cream/80 backdrop-blur-md
        border-b border-baraka-sage/20
      ">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="BarakaFlow"
              width={36}
              height={36}
              className="rounded-lg"
            />
            <span className="font-bold text-xl text-baraka-dark">
              Baraka<span className="text-baraka-primary">Flow</span>
            </span>
          </div>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-8">
            
            <a  href="#features"
              className="text-sm text-baraka-sage hover:text-baraka-dark transition-colors"
            >
              Features
            </a>
            
            <a  href="#why"
              className="text-sm text-baraka-sage hover:text-baraka-dark transition-colors"
            >
              Why BarakaFlow
            </a>
          </div>

          {/* Auth buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="
                text-sm font-medium
                text-baraka-dark hover:text-baraka-primary
                transition-colors
              "
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="
                text-sm font-medium
                bg-baraka-primary hover:bg-baraka-dark
                text-white px-4 py-2 rounded-lg
                transition-colors
              "
            >
              Get Started Free
            </Link>
          </div>

        </div>
      </nav>

      {/* ══════════════════════════════════════
          HERO SECTION
          The most important part of the page
          First thing visitors see
      ══════════════════════════════════════ */}
      <section className="
        max-w-6xl mx-auto px-6
        pt-20 pb-24
        text-center
      ">

        {/* Badge */}
        <div className="
          inline-flex items-center gap-2
          bg-baraka-primary/10 text-baraka-primary
          px-4 py-1.5 rounded-full text-sm font-medium
          mb-6
        ">
          <Zap size={14} />
          Built for furniture businesses in Rwanda 🇷🇼
        </div>

        {/* Main headline */}
        <h1 className="
          text-4xl md:text-6xl font-bold
          text-baraka-dark
          leading-tight mb-6
        ">
          Stop Managing Stock
          <br />
          <span className="text-baraka-primary">
            With Notebooks.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="
          text-lg text-baraka-sage
          max-w-2xl mx-auto mb-10
          leading-relaxed
        ">
          BarakaFlow helps furniture shops track inventory,
          record orders, and understand their business —
          all in one place. No more lost records.
          No more manual counting.
        </p>

        {/* CTA Buttons */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/register"
            className="
              flex items-center gap-2
              bg-baraka-primary hover:bg-baraka-dark
              text-white font-semibold
              px-8 py-3.5 rounded-xl
              transition-colors shadow-lg
              shadow-baraka-primary/25
            "
          >
            Start Free Today
            <ArrowRight size={18} />
          </Link>
          <Link
            href="/login"
            className="
              flex items-center gap-2
              bg-white hover:bg-baraka-sage/10
              text-baraka-dark font-semibold
              px-8 py-3.5 rounded-xl
              border border-baraka-sage/30
              transition-colors
            "
          >
            Sign Into My Account
          </Link>
        </div>

        {/* Social proof */}
        <p className="text-sm text-baraka-sage mt-8">
          ✓ Free to start &nbsp;·&nbsp; ✓ No credit card needed
          &nbsp;·&nbsp; ✓ Ready in 2 minutes
        </p>

      </section>

      {/* ══════════════════════════════════════
          FEATURES SECTION
      ══════════════════════════════════════ */}
      <section id="features" className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-6">

          {/* Section header */}
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-baraka-dark mb-4">
              Everything your shop needs
            </h2>
            <p className="text-baraka-sage max-w-xl mx-auto">
              Designed specifically for furniture shops
              that import from China and Dubai and sell
              across Rwanda.
            </p>
          </div>

          {/* Features grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

            {[
              {
                icon:        Package,
                color:       "bg-blue-100 text-blue-600",
                title:       "Inventory Tracking",
                description: "Know exactly what's in your warehouse at all times. Get alerts when stock runs low before you run out.",
              },
              {
                icon:        ShoppingCart,
                color:       "bg-baraka-sage/30 text-baraka-primary",
                title:       "Order Management",
                description: "Record every sale. Track pending, confirmed, and delivered orders. Stock updates automatically.",
              },
              {
                icon:        BarChart3,
                color:       "bg-emerald-100 text-emerald-600",
                title:       "Business Reports",
                description: "See your best-selling products, monthly revenue, and delivery rates in one clear dashboard.",
              },
              {
                icon:        Truck,
                color:       "bg-orange-100 text-orange-600",
                title:       "Supplier Management",
                description: "Keep all your China and Dubai supplier contacts organized. Know which supplier provides which product.",
              },
            ].map(feature => (
              <div
                key={feature.title}
                className="
                  bg-baraka-cream rounded-2xl p-6
                  hover:shadow-md transition-shadow
                "
              >
                <div className={`
                  w-12 h-12 rounded-xl
                  flex items-center justify-center
                  mb-4 ${feature.color}
                `}>
                  <feature.icon size={22} />
                </div>
                <h3 className="font-bold text-baraka-dark mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-baraka-sage leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          WHY BARAKAFLOW SECTION
      ══════════════════════════════════════ */}
      <section id="why" className="py-20 bg-baraka-cream">
        <div className="max-w-6xl mx-auto px-6">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">

            {/* Left — problem story */}
            <div>
              <h2 className="text-3xl font-bold text-baraka-dark mb-6">
                We built this for shops
                like yours
              </h2>
              <p className="text-baraka-sage mb-8 leading-relaxed">
                In Mugakiriro, Gasabo District — furniture shops
                manage hundreds of products from China and Dubai,
                serve clients across Rwanda, and track everything
                in handwritten notebooks.
              </p>
              <p className="text-baraka-sage mb-8 leading-relaxed">
                One lost notebook. One miscounted shipment.
                One forgotten order. That's money lost.
                BarakaFlow exists to fix that.
              </p>

              {[
                "Real-time stock levels — always accurate",
                "Every order recorded with customer details",
                "Automatic stock deduction when orders delivered",
                "Full audit trail — know who changed what",
                "Works on phone, tablet, and computer",
              ].map(point => (
                <div key={point} className="flex items-start gap-3 mb-3">
                  <CheckCircle
                    size={18}
                    className="text-baraka-primary shrink-0 mt-0.5"
                  />
                  <span className="text-sm text-baraka-dark">
                    {point}
                  </span>
                </div>
              ))}
            </div>

            {/* Right — stats */}
            <div className="space-y-4">

              {[
                {
                  icon:  TrendingUp,
                  color: "bg-emerald-100 text-emerald-600",
                  stat:  "100%",
                  label: "Digital record keeping",
                  sub:   "No more lost notebooks",
                },
                {
                  icon:  Zap,
                  color: "bg-yellow-100 text-yellow-600",
                  stat:  "2 min",
                  label: "To add a new order",
                  sub:   "From phone call to recorded",
                },
                {
                  icon:  Shield,
                  color: "bg-blue-100 text-blue-600",
                  stat:  "0",
                  label: "Data loss risk",
                  sub:   "Cloud backup — always safe",
                },
              ].map(item => (
                <div
                  key={item.stat}
                  className="
                    bg-white rounded-2xl p-6
                    border border-baraka-sage/20
                    flex items-center gap-5
                    shadow-sm
                  "
                >
                  <div className={`
                    w-14 h-14 rounded-xl shrink-0
                    flex items-center justify-center
                    ${item.color}
                  `}>
                    <item.icon size={24} />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-baraka-dark">
                      {item.stat}
                    </p>
                    <p className="text-sm font-medium text-baraka-dark">
                      {item.label}
                    </p>
                    <p className="text-xs text-baraka-sage mt-0.5">
                      {item.sub}
                    </p>
                  </div>
                </div>
              ))}

            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FINAL CTA SECTION
      ══════════════════════════════════════ */}
      <section className="bg-baraka-dark py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">

          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to grow your business?
          </h2>
          <p className="text-baraka-cream mb-10 text-lg">
            Join furniture shops across Rwanda
            managing their business the smart way.
          </p>

          <Link
            href="/register"
            className="
              inline-flex items-center gap-2
              bg-baraka-primary hover:bg-baraka-primary/80
              text-white font-bold
              px-10 py-4 rounded-xl
              transition-colors
              text-lg shadow-xl
            "
          >
            Create Free Account
            <ArrowRight size={20} />
          </Link>

          <p className="text-baraka-sage text-sm mt-6">
            Free to start. No credit card required.
          </p>

        </div>
      </section>

      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <footer className="bg-baraka-dark border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="BarakaFlow"
              width={28}
              height={28}
              className="rounded-lg opacity-80"
            />
            <span className="text-sm text-baraka-sage">
              BarakaFlow — Built in Rwanda 🇷🇼
            </span>
          </div>
          <p className="text-xs text-baraka-sage/70">
            © {new Date().getFullYear()} BarakaFlow.
            All rights reserved.
          </p>
        </div>
      </footer>

    </div>
  )
}