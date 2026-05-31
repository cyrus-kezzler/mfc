import { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import { COLOR, FONT, smallCaps, tabularNums } from '@/lib/design'

export const metadata: Metadata = {
  title: 'Strategy & Targets — The Back Bar',
  description: 'Myatt\'s Fields Cocktails — strategic direction, goals, and how we are getting there.',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Section {
  id: string
  label: string        // short nav label
  title: string        // full section title
  subtitle: string     // one-line descriptor
  status: 'live' | 'draft' | 'planned'
  updatedDate: string
  content: React.ReactNode
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: {
    background: COLOR.paper,
    minHeight: '100vh',
    color: COLOR.ink,
    fontFamily: FONT.sans,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '240px 1fr',
    maxWidth: 1200,
    margin: '0 auto',
  },
  sidebar: {
    padding: '56px 28px 56px 40px',
    position: 'sticky' as const,
    top: 60,
    height: 'calc(100vh - 60px)',
    overflowY: 'auto' as const,
    borderRight: `1px solid ${COLOR.rule}`,
  },
  sidebarLabel: {
    fontSize: 10,
    color: COLOR.muted,
    marginBottom: 14,
    fontWeight: 500,
    ...smallCaps,
  },
  sidebarLink: (active: boolean) => ({
    display: 'block',
    padding: '8px 0',
    fontSize: 13,
    color: active ? COLOR.accent : COLOR.inkSoft,
    textDecoration: 'none',
    fontWeight: active ? 500 : 400,
    fontFamily: FONT.serif,
  }),
  main: {
    padding: '56px 48px 96px',
    maxWidth: 820,
  },
  intro: {
    borderBottom: `1px solid ${COLOR.rule}`,
    paddingBottom: 40,
    marginBottom: 48,
  },
  eyebrow: {
    fontSize: 10,
    color: COLOR.muted,
    marginBottom: 18,
    ...smallCaps,
  },
  pageHeading: {
    fontFamily: FONT.serif,
    fontSize: 'clamp(44px, 6vw, 56px)',
    fontWeight: 400,
    letterSpacing: '-0.025em',
    lineHeight: 1.02,
    marginBottom: 18,
    color: COLOR.ink,
  },
  pageSubtitle: {
    fontFamily: FONT.serif,
    fontStyle: 'italic' as const,
    fontSize: 18,
    color: COLOR.inkSoft,
    lineHeight: 1.55,
    maxWidth: 680,
    fontWeight: 300,
  },
  sectionBlock: {
    marginBottom: 80,
    paddingBottom: 72,
    borderBottom: `1px solid ${COLOR.rule}`,
  },
  sectionHeader: {
    marginBottom: 28,
  },
  sectionMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
    flexWrap: 'wrap' as const,
  },
  sectionLabel: {
    fontFamily: FONT.mono,
    fontSize: 11,
    color: COLOR.muted,
    letterSpacing: '0.08em',
  },
  statusBadge: (status: string) => ({
    fontSize: 10,
    color:
      status === 'live' ? COLOR.accent : status === 'draft' ? COLOR.accentSoft : COLOR.mutedLight,
    ...smallCaps,
  }),
  dateBadge: {
    fontSize: 10,
    color: COLOR.mutedLight,
    ...smallCaps,
  },
  sectionTitle: {
    fontFamily: FONT.serif,
    fontSize: 32,
    fontWeight: 500,
    color: COLOR.ink,
    letterSpacing: '-0.015em',
    lineHeight: 1.15,
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontFamily: FONT.serif,
    fontStyle: 'italic' as const,
    fontSize: 15,
    color: COLOR.muted,
    lineHeight: 1.55,
  },
  body: {
    fontFamily: FONT.serif,
    fontSize: 17,
    lineHeight: 1.75,
    color: COLOR.inkSoft,
  },
  p: {
    marginBottom: 20,
  },
  highlight: {
    borderLeft: `3px solid ${COLOR.accent}`,
    padding: '8px 0 8px 18px',
    margin: '28px 0',
    fontFamily: FONT.serif,
    fontSize: 16,
    color: COLOR.inkSoft,
    lineHeight: 1.7,
    fontStyle: 'italic' as const,
  },
  keyFact: {
    display: 'inline-block',
    padding: '12px 20px',
    textAlign: 'center' as const,
    minWidth: 100,
  },
  keyFactValue: {
    fontFamily: FONT.serif,
    fontSize: 28,
    fontWeight: 400,
    color: COLOR.ink,
    display: 'block',
    marginBottom: 2,
    letterSpacing: '-0.01em',
    ...tabularNums,
  },
  keyFactLabel: {
    fontSize: 10,
    color: COLOR.muted,
    ...smallCaps,
  },
  factsRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 24,
    margin: '32px 0',
    borderTop: `1px solid ${COLOR.rule}`,
    borderBottom: `1px solid ${COLOR.rule}`,
    padding: '20px 0',
  },
  plannedBlock: {
    borderTop: `1px solid ${COLOR.rule}`,
    borderBottom: `1px solid ${COLOR.rule}`,
    padding: '40px 24px',
    textAlign: 'center' as const,
    color: COLOR.muted,
    fontSize: 14,
    fontFamily: FONT.serif,
    fontStyle: 'italic' as const,
  },
  subhead: {
    fontFamily: FONT.serif,
    fontSize: 21,
    fontWeight: 500,
    color: COLOR.ink,
    letterSpacing: '-0.01em',
    lineHeight: 1.25,
    marginTop: 44,
    marginBottom: 16,
  },
  ol: {
    fontFamily: FONT.serif,
    fontSize: 17,
    lineHeight: 1.7,
    color: COLOR.inkSoft,
    paddingLeft: 22,
    margin: '20px 0',
  },
  li: {
    marginBottom: 12,
    paddingLeft: 6,
  },
  link: {
    color: COLOR.accent,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    textDecorationThickness: 1,
  } as React.CSSProperties,
}

// Bolded lead at the start of a body paragraph — gold-accent treatment to
// match the inline "COGS × 1.40 + shipping" highlight on section 01.
const Lead = ({ children }: { children: React.ReactNode }) => (
  <strong style={{ color: COLOR.accent, fontWeight: 600 }}>{children}</strong>
)

// ─── Content sections ─────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: 'wholesale-pricing',
    label: 'Wholesale Pricing',
    title: 'Wholesale Pricing Strategy',
    subtitle: 'How we arrived at a cost-forward model and what it changes',
    status: 'live',
    updatedDate: 'April 2026',
    content: (
      <div style={S.body}>
        <p style={S.p}>
          For most of Myatt&apos;s Fields&apos; history, wholesale pricing was set reactively — working backwards
          from RRP using a fixed margin formula that bore no systematic relationship to the actual cost of making
          each cocktail. As the range grew and ingredient costs fluctuated, this left pricing inconsistent across
          the catalogue and made it impossible to know, at a glance, whether a given product was generating a
          sustainable return at wholesale.
        </p>

        <p style={S.p}>
          In April 2026, we built a single source of truth for pricing. The approach is cost-forward: every
          wholesale price is calculated as <strong style={{ color: COLOR.accent }}>COGS × 1.40 + shipping</strong>,
          where COGS reflects the true ingredient cost of each bottled cocktail and shipping covers the per-unit
          fulfilment cost. The 40% markup on cost (equivalent to roughly 28% gross margin) is the minimum needed
          to make wholesale commercially viable, while leaving retailers sufficient room to price at their standard
          30% margin and still land below our RRP including VAT.
        </p>

        <div style={S.highlight}>
          <strong style={{ color: COLOR.accent }}>The retailer test:</strong> for any wholesale price to be viable,
          Wholesale × 1.30 (retailer margin) × 1.20 (VAT) must be ≤ RRP. If a retailer cannot mark our product
          up to their standard margin and still price it below our own RRP, they will not stock it — or they will
          discount it in ways that undercut us online.
        </div>

        <p style={S.p}>
          In building this model, we audited all 34 active SKUs, discontinued four defunct products (Kecello,
          Limoncello, and Yuzu Negroni), and updated RRPs across 12 products where the previous price was too
          low to support the formula. The largest change was the Manhattan 500ml, which moved from £38.50 to
          £41.00, reflecting its award-winning status and the genuine cost of the rye and vermouth that go into it.
        </p>

        <div style={S.factsRow}>
          {[
            { value: '30', label: 'Active SKUs' },
            { value: '40%', label: 'Markup on COGS' },
            { value: '30/30', label: 'Pass retailer test' },
            { value: '12', label: 'RRPs updated' },
            { value: '4', label: 'SKUs discontinued' },
          ].map(({ value, label }) => (
            <div key={label} style={S.keyFact}>
              <span style={S.keyFactValue}>{value}</span>
              <span style={S.keyFactLabel}>{label}</span>
            </div>
          ))}
        </div>

        <p style={S.p}>
          The result is 30 SKUs with confirmed wholesale prices, all of which pass the retailer test, and a live
          pricing module in The Back Bar where COGS can be updated as ingredient costs change — with the impact
          flowing through to wholesale prices instantly. This moves pricing from a periodic, manual exercise
          to a live business tool.
        </p>

        <p style={{ ...S.p, marginBottom: 0 }}>
          The next step is to use these confirmed prices as the basis for our first proactive wholesale
          outreach campaign — the 500-unit gift box campaign targeting florists, corporates, delis, and gift
          shops ahead of the 2027 rebrand.
        </p>
      </div>
    ),
  },
  {
    id: 'wholesale-growth',
    label: 'Wholesale Growth',
    title: 'Wholesale Growth Strategy',
    subtitle: 'Box campaign, new accounts, and moving from reactive to proactive',
    status: 'planned',
    updatedDate: 'Coming soon',
    content: null,
  },
  {
    id: 'dtc',
    label: 'Direct to Consumer',
    title: 'Direct to Consumer',
    subtitle: 'Shopify, Amazon, and the DTC channel strategy',
    status: 'live',
    updatedDate: 'May 2026',
    content: (
      <div style={S.body}>
        <p style={S.p}>
          This is how the Direct to Consumer side of MFC works — what Shopify is for, what Amazon
          is for, how each is priced, and what we will and will not do to grow them. Wholesale is
          the other half of the business and is covered in{' '}
          <a href="#wholesale-pricing" style={S.link}>the wholesale pricing strategy section</a>;
          it appears here only where the two channels touch.
        </p>

        <div style={S.subhead}>The shape of the business today</div>
        <p style={S.p}>
          Wholesale carries most of MFC&apos;s revenue. Over the last twelve months Cripps Barn Group
          accounted for 60% of B2B sales and Fortnum &amp; Mason for 19% — together 79% of the business
          by revenue. The top five customers reach 93%. The long tail of delis, hotels, and specialist
          retailers fills in the rest. Shopify is smaller, profitable, and growing; Amazon is smaller
          still and is treated as awareness, not revenue.
        </p>

        <div style={S.factsRow}>
          {[
            { value: '60%', label: 'Cripps Barn' },
            { value: '19%', label: "Fortnum's" },
            { value: '79%', label: 'Top two together' },
            { value: '93%', label: 'Top five' },
          ].map(({ value, label }) => (
            <div key={label} style={S.keyFact}>
              <span style={S.keyFactValue}>{value}</span>
              <span style={S.keyFactLabel}>{label}</span>
            </div>
          ))}
        </div>

        <p style={{ ...S.p, marginBottom: 0 }}>
          The strategic implication is simple. Two stockists hold the company up. We are grateful for
          them and we look after them carefully, but we cannot stay in that shape forever. Wholesale
          outreach is the response on the B2B side; DTC growth is the response on the consumer side.
          They are the same motion: hedge the concentration, own more of the relationship.
        </p>

        <div style={S.subhead}>Why DTC matters</div>
        <p style={S.p}>
          <Lead>Margin.</Lead> Shopify is the only channel where MFC captures the full retail price.
          Wholesale is profitable, but the customer pays roughly half of what an end consumer pays on
          our site. Every Shopify order is worth materially more per bottle than a wholesale equivalent.
        </p>
        <p style={S.p}>
          <Lead>Relationship.</Lead> A Shopify customer signs up to the newsletter, opens a follow-up,
          comes back for Christmas. We know who they are. A wholesale customer is one degree of
          separation away — the brand belongs to MFC, but the relationship belongs to Cripps or to
          Fortnum&apos;s. Shopify is where we earn the right to a customer&apos;s repeat business in our own name.
        </p>
        <p style={S.p}>
          <Lead>Hedge.</Lead> As long as 79% of revenue sits with two accounts, the company is
          structurally fragile. A larger DTC base reduces that fragility. We do not need to replace
          wholesale — we need to make sure the business survives the day Cripps doesn&apos;t reorder.
        </p>

        <div style={S.subhead}>Channel roles</div>
        <p style={S.p}>
          <Lead>Shopify</Lead> is the relationship channel and the growth channel. The customer
          experience is fully ours, the data is ours, and the margin is ours. Everything we do on
          Shopify is aimed at one of three outcomes: a first order from someone new, a larger basket
          from someone visiting, or a repeat order from someone we have served before.
        </p>
        <p style={S.p}>
          <Lead>Amazon</Lead> is an awareness channel only. We use it because people search for
          cocktail brands on Amazon and we want them to find MFC. We do not use it to compete on price,
          to win Buy Box, or to grow Amazon-native revenue. We pulled out of FBA earlier in 2026 and we
          will not return. The storefront exists to be findable and to redirect demand to Shopify.
        </p>
        <p style={S.p}>
          <Lead>Wholesale</Lead> is the revenue engine and is covered separately. It is referenced here
          only for context.
        </p>

        <div style={S.subhead}>Pricing architecture</div>
        <p style={S.p}>
          Pricing is set by positioning, not by cost. MFC is a premium cocktail maker — real
          ingredients, in-house production, no shortcuts, partnerships with people whose names we are
          proud to put on a bottle. We are more expensive than the brands we are usually compared to
          because we make a different product. That is the position, and the RRP reflects it.
        </p>
        <p style={S.p}>
          The 40% markup on COGS — <strong style={{ color: COLOR.accent }}>COGS × 1.40 + shipping</strong> —
          is the floor underneath. It is the cost discipline that ensures the position is profitable. It
          is not the strategy. Any SKU that fails to clear the floor is unprofitable enough to question;
          every SKU on the April 2026 sheet clears it. The architecture has three rules.
        </p>
        <ol style={S.ol}>
          <li style={S.li}>
            <Lead>Shopify RRP is the canonical RRP.</Lead> The price on mfc.london is the reference
            price for the brand — the input to{' '}
            <a href="/finances/pricing" style={S.link}>the wholesale tool</a>, not an output of it.
          </li>
          <li style={S.li}>
            <Lead>Wholesale price is set so a stockist can match our RRP at a 30% margin plus VAT.</Lead>{' '}
            This protects the trade relationship and prevents stockists from undercutting us, which would
            erode our channel and theirs.
          </li>
          <li style={S.li}>
            <Lead>Amazon is priced above Shopify deliberately.</Lead> The spread is around 15%. The intent
            is to make Amazon the more expensive way to buy MFC, pushing price-sensitive buyers toward our
            own site, where we own the relationship and the margin.
          </li>
        </ol>

        <div style={S.subhead}>Order economics on Shopify</div>
        <p style={S.p}>
          The customer pays the carrier rate directly — Shopify calculates and prints the label, MFC does
          not mark it up. Current rates run from £2.95 for a single 500ml to £9.69 for 9–15 bottles. The
          shipping box is currently absorbed into per-bottle COGS, a modelling artefact that overstates COGS
          on multi-bottle orders where one box covers six bottles. The boxes themselves are good: 93p for the
          six-bottle 700ml box (the size we use for Cripps) and £1.90 for the six-bottle 500ml box, which is
          from an older generation of the brand and will be reviewed as stock runs down.
        </p>
        <p style={S.p}>
          A one-bottle order generates modest contribution — the carrier rate and box cost are a meaningful
          share of the line. A <strong style={{ color: COLOR.accent }}>multi-bottle order of full-size drinks</strong>{' '}
          (250ml or 500ml) is where Shopify generates real margin: the fulfilment overhead is amortised across
          the basket and contribution multiplies. Choose Six and boxsets are a different product entirely —
          built from 50ml drinks, they return roughly £1 of contribution per drink at full RRP. Boxsets sit
          near breakeven once box, carrier, and pick-and-pack are loaded in; Choose Six technically loses money.
        </p>
        <p style={S.p}>
          This sets up the most important framing in the channel. The 50ml products are discovery and gifting,
          not margin. Their job is to put MFC bottles into the hands of people who have never tried us, in a
          format they can give away or try across. They earn their keep by seeding the second order — the
          full-size repeat — which is where the channel actually generates margin. A free-shipping hurdle is
          the right next step, set at the basket value where contribution from full-size drinks comfortably
          covers fulfilment, not one that includes 50ml products at a loss.
        </p>

        <div style={S.subhead}>What we offer customers on Shopify</div>
        <p style={S.p}>
          <Lead>Best sellers</Lead> as the entry point and the margin centre. The drinks that have already
          proven themselves carry the weight of first impressions and are the format that pays for the channel:
          Espresso Martini, Manhattan, Negroni.
        </p>
        <p style={S.p}>
          <Lead>Choose Six</Lead> as the discovery instrument. A self-selected 50ml mix that loses money on its
          own and earns it back by converting first-time triers into full-size repeat buyers. It is a customer
          acquisition cost paid in product form, accepted deliberately.
        </p>
        <p style={S.p}>
          <Lead>Boxsets</Lead> as the gift and the introduction. Six 50ml drinks in a clean package, near
          breakeven once fulfilment is loaded in. The cleanest answer to &ldquo;what should I get my dad&rdquo; and to
          &ldquo;I have never tried MFC.&rdquo; Same logic as Choose Six: pay for discovery, win the second order.
        </p>
        <p style={S.p}>
          <Lead>Limited Editions</Lead> as scarcity that reinforces the premium position. The Clementini at
          Fortnum&apos;s and the Manhattan award are the proof. We will continue to make drinks that are not always
          available.
        </p>

        <div style={S.highlight}>
          <strong style={{ color: COLOR.accent }}>A note on 50ml.</strong> The 50ml format will not survive the
          rebrand. Today&apos;s economics are flattered by the fact that the 50ml glass was bought in 2018 and written
          off years ago, so we currently ascribe it zero cost. Any successor format will carry real glass cost,
          which means the discovery instrument needs to be re-engineered — not just rebranded. The strategic role
          of discovery does not change. The vehicle does.
        </div>

        <div style={S.highlight}>
          <strong style={{ color: COLOR.accent }}>Membership (proposed, not committed).</strong> A reserved
          offering — first access to limited editions, named bottle programmes, periodic small drops. Access, not
          discounting. We are open to the idea and will return to it in 2026 if the right shape emerges. We are not
          committing to it here.
        </div>

        <div style={S.subhead}>What we won&apos;t do</div>
        <p style={S.p}>
          <Lead>Subscription discounting.</Lead> We have considered it, and our default answer is no. A premium
          maker does not solve repeat purchase by giving 15% off every month; doing so commoditises the brand and
          trains the customer to wait for the discount. If we offer recurring purchase, the value to the customer
          will be access, not price.
        </p>
        <p style={S.p}>
          <Lead>Negative-contribution paid acquisition.</Lead> All MFC production is in-house — Clemency makes
          every drink, and there is no spare capacity to acquire customers at a loss and earn back later, because
          there is no idle &ldquo;later capacity.&rdquo; Paid acquisition is sized to what each campaign can return now. The
          one accepted exception is the 50ml discovery product (Choose Six, boxsets), loss-making by design and
          earning its keep through the second order, not the first.
        </p>
        <p style={S.p}>
          <Lead>Price-matching cheaper competitors.</Lead> We are not them. The premise of our pricing is that we
          make a different product. Conceding the premium is conceding the brand.
        </p>
        <p style={S.p}>
          <Lead>Selling on Amazon below Shopify RRP.</Lead> Ever. The point of Amazon is to redirect demand.
          Underpricing Amazon defeats the channel architecture and undermines our own site.
        </p>

        <div style={S.subhead}>What growth looks like for DTC</div>
        <p style={S.p}>
          Growth comes from four motions, in order of weight.
        </p>
        <ol style={S.ol}>
          <li style={S.li}>
            <Lead>Fix email click-through.</Lead> Shopify Messaging open rate is acceptable; click rate is the
            bottleneck. The four-week test in May and June is the lever.
          </li>
          <li style={S.li}>
            <Lead>Win the second order.</Lead> Choose Six and boxsets bring first-time triers in at a loss. The
            channel works when those triers come back for full-size bottles of the drink they fell in love with.
            Everything from packaging inserts to post-purchase email to homepage architecture should be aimed at
            making that second order frictionless.
          </li>
          <li style={S.li}>
            <Lead>Use boxsets as periodic acquisition moments.</Lead> Father&apos;s Day, Christmas, and any anniversary
            release. The boxset is the simplest answer to a gifting moment and the simplest first-time-buyer entry.
            It is sized to discovery, not to revenue.
          </li>
          <li style={S.li}>
            <Lead>Wholesale outreach.</Lead> In parallel, the trade list expansion reduces the concentration of B2B
            revenue. The two motions reinforce each other: a broader trade base makes us less dependent on any one
            stockist; a stronger DTC channel makes us less dependent on the trade base entirely.
          </li>
        </ol>
        <p style={S.p}>
          We are not trying to win paid acquisition arbitrage. We are trying to be the brand people remember and
          come back to.
        </p>

        <div style={S.subhead}>Open questions to resolve</div>
        <ol style={S.ol}>
          <li style={S.li}>
            <Lead>Free shipping hurdle.</Lead> Modelling in progress. Output: the basket value at which carrier
            plus box plus pick-and-pack are comfortably covered by contribution margin.
          </li>
          <li style={S.li}>
            <Lead>500ml box swap.</Lead> The new 700ml box at 93p is materially better than the £1.90 500ml box.
            Consolidating to one box format would improve fulfilment unit economics and simplify packing.
          </li>
          <li style={S.li}>
            <Lead>Confirm Amazon spread.</Lead> Proposing 15% above Shopify RRP. To be confirmed before the Amazon
            refresh.
          </li>
          <li style={S.li}>
            <Lead>Membership / exclusives club.</Lead> Park or commit. If we commit, it is access-based, not
            discount-based.
          </li>
          <li style={S.li}>
            <Lead>QuickBooks customer hygiene.</Lead> D2C orders are appearing in QB as &ldquo;None&rdquo; rather than as
            Shopify-tagged, which obscures DTC revenue in our reporting and should be fixed.
          </li>
          <li style={{ ...S.li, marginBottom: 0 }}>
            <Lead>Successor to 50ml discovery format.</Lead> The 50ml format is retiring in the rebrand. The
            discovery role is essential to the channel and needs a new vehicle whose economics work without a free
            glass dividend.
          </li>
        </ol>
      </div>
    ),
  },
  {
    id: 'rebrand',
    label: '2027 Rebrand',
    title: '2027 Rebrand',
    subtitle: 'Planning the next chapter of the brand',
    status: 'planned',
    updatedDate: 'Coming soon',
    content: null,
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StrategyPage() {
  const liveCount = SECTIONS.filter(s => s.status === 'live').length

  return (
    <div style={S.page}>
      <Nav />
      <div style={S.layout} className="strategy-layout">
        <aside style={S.sidebar} className="strategy-sidebar">
          <div style={S.sidebarLabel}>Sections</div>
          {SECTIONS.map(section => (
            <a
              key={section.id}
              href={`#${section.id}`}
              style={S.sidebarLink(false)}
            >
              {section.label}
              {section.status === 'live' && (
                <span style={{ marginLeft: 8, fontSize: 9, color: COLOR.accent }}>●</span>
              )}
              {section.status === 'planned' && (
                <span style={{ marginLeft: 8, fontSize: 9, color: COLOR.mutedLight }}>○</span>
              )}
            </a>
          ))}
        </aside>

        <main style={S.main} className="strategy-main">
          <div style={S.intro}>
            <p style={S.eyebrow}>Strategy & targets</p>
            <h1 style={S.pageHeading}>Direction & goals</h1>
            <p style={S.pageSubtitle}>
              {liveCount} of {SECTIONS.length} sections written — how we are pricing,
              growing wholesale, and getting to the 2027 rebrand.
            </p>
          </div>

          {SECTIONS.map((section, i) => (
            <section
              key={section.id}
              id={section.id}
              style={i < SECTIONS.length - 1 ? S.sectionBlock : { marginBottom: 0 }}
            >
              <div style={S.sectionHeader}>
                <div style={S.sectionMeta}>
                  <span style={S.sectionLabel}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={S.statusBadge(section.status)}>
                    {section.status === 'live'
                      ? 'Live'
                      : section.status === 'draft'
                      ? 'Draft'
                      : 'Planned'}
                  </span>
                  <span style={S.dateBadge}>{section.updatedDate}</span>
                </div>
                <div style={S.sectionTitle}>{section.title}</div>
                <div style={S.sectionSubtitle}>{section.subtitle}</div>
              </div>

              {section.content ?? (
                <div style={S.plannedBlock}>
                  This section will be added after we work through it together.
                </div>
              )}
            </section>
          ))}
        </main>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .strategy-layout { grid-template-columns: 1fr !important; }
          .strategy-sidebar {
            position: static !important;
            height: auto !important;
            border-right: none !important;
            border-bottom: 1px solid ${COLOR.rule} !important;
            padding: 24px 20px !important;
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
          }
          .strategy-main { padding: 32px 20px 64px !important; }
        }
      `}</style>
    </div>
  )
}
