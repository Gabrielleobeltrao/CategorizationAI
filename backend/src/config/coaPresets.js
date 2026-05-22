// Starter Chart of Accounts presets, applied to a client when its CoA
// is empty. Each preset = { id, label, description, accounts[] }.
//
// Philosophy: deliver the MINIMUM useful CoA — usually 10-12 accounts.
// The accountant adds more later as transactions need them. Overloading
// the chart upfront is what bookkeepers complain about with templates.
//
// Each account has { name, accountType, description }. The description
// is what the LLM categorizer reads when assigning a transaction to
// this account, so it must be rich in:
//   - Semantic intent (what kind of activity belongs here)
//   - Typical merchants / payees (concrete vendor names)
//   - Example bank statement descriptions (uppercased fragments)

const BANK_ACCOUNT = {
  name: "Business Checking",
  accountType: "asset_current",
  description:
    "Primary business checking account. Rename to match your real bank. All deposits, debit card purchases, ACH transfers, and outgoing payments flow through here. Statement descriptions usually start with the bank name (CHASE, BOFA, WELLS FARGO).",
}

const OWNERS_CAPITAL = {
  name: "Owner's Capital",
  accountType: "equity",
  description:
    "Money the owner puts into or takes out of the business. Initial investment, mid-year cash injections, and owner's draws. For corporations, rename to 'Common Stock' / 'Retained Earnings'.",
}

const BANK_FEES = {
  name: "Bank Fees",
  accountType: "operating_expense",
  description:
    "Bank service charges, wire fees, NSF/overdraft fees, monthly maintenance, ATM fees. Look for: 'SERVICE CHARGE', 'WIRE FEE', 'OVERDRAFT', 'MONTHLY FEE', 'ATM FEE'.",
}

const INCOME_TAX = {
  name: "Income Tax",
  accountType: "tax_expense",
  description:
    "Federal and state income tax payments. IRS quarterly estimates (EFTPS, IRS USATAXPYMT), state department of revenue (NYS DTF, FRANCHISE TAX BD), tax extensions.",
}

// Every preset starts with these four. Industry-specific accounts go on top.
const UNIVERSAL_CORE = [BANK_ACCOUNT, OWNERS_CAPITAL, BANK_FEES, INCOME_TAX]

function preset(id, label, description, industryAccounts) {
  return {
    id,
    label,
    description,
    accounts: [...industryAccounts, ...UNIVERSAL_CORE],
  }
}

const PRESETS = [
  preset(
    "service_business",
    "Service business / consulting / agency",
    "Consultants, agencies, freelancers, software companies, design studios.",
    [
      {
        name: "Service Revenue",
        accountType: "income",
        description:
          "Revenue from client services: consulting fees, project payments, retainers, hourly billing. Stripe payouts, client ACH deposits, Wise transfers, checks from clients.",
      },
      {
        name: "Contractor Payments",
        accountType: "cost_of_goods_sold",
        description:
          "Payments to independent contractors and freelancers directly delivering work to clients. Upwork, Fiverr, direct ACH/Wise/Zelle to 1099 contractors.",
      },
      {
        name: "Software & Subscriptions",
        accountType: "operating_expense",
        description:
          "SaaS tools and recurring software. AWS, Google Workspace, Microsoft 365, Slack, Notion, Figma, GitHub, Adobe, Dropbox, Zoom.",
      },
      {
        name: "Advertising & Marketing",
        accountType: "operating_expense",
        description:
          "Paid ads and marketing. Google Ads, Facebook/Meta Ads, LinkedIn Ads, sponsored content.",
      },
      {
        name: "Meals & Travel",
        accountType: "operating_expense",
        description:
          "Business meals, client meetings, business travel (flights, hotels, rideshare). Restaurants, Uber/Lyft, United, Delta, Marriott, Airbnb business.",
      },
      {
        name: "Office Expenses",
        accountType: "operating_expense",
        description:
          "Office rent, utilities, office supplies, internet. WeWork, Regus, Comcast, Verizon, Staples.",
      },
    ],
  ),

  preset(
    "retail_ecommerce",
    "Retail / e-commerce",
    "Online stores, Shopify/Amazon/Etsy sellers, physical retail shops.",
    [
      {
        name: "Product Sales",
        accountType: "income",
        description:
          "Revenue from selling products. Shopify payouts, Amazon settlement, Etsy deposits, eBay payouts, Square retail, WooCommerce.",
      },
      {
        name: "Inventory Purchases",
        accountType: "cost_of_goods_sold",
        description:
          "Cost of goods bought for resale: inventory from suppliers, raw materials. Alibaba, Faire, wholesale distributors.",
      },
      {
        name: "Shipping & Fulfillment",
        accountType: "cost_of_goods_sold",
        description:
          "Shipping carriers and fulfillment. USPS, UPS, FedEx, DHL, ShipStation, ShipBob, Amazon FBA fees, packaging materials.",
      },
      {
        name: "Merchant & Platform Fees",
        accountType: "cost_of_goods_sold",
        description:
          "Payment processing and marketplace fees. Stripe, PayPal, Square, Shopify Payments fees, Amazon referral fees, Etsy transaction fees.",
      },
      {
        name: "Advertising",
        accountType: "operating_expense",
        description:
          "Paid ads driving sales. Google Ads, Facebook/Meta Ads, TikTok Ads, Klaviyo email marketing.",
      },
      {
        name: "Software & Subscriptions",
        accountType: "operating_expense",
        description:
          "Shopify subscription, Shopify apps, email marketing, inventory software, accounting software. Recurring monthly tech bills.",
      },
    ],
  ),

  preset(
    "construction_trades",
    "Construction / general contractor",
    "General contractors, builders, remodelers, electricians, plumbers, HVAC, roofers.",
    [
      {
        name: "Construction Revenue",
        accountType: "income",
        description:
          "Revenue from construction projects, job invoices, progress payments. Direct deposits from clients, GC payments, draw schedule payments.",
      },
      {
        name: "Materials & Supplies",
        accountType: "cost_of_goods_sold",
        description:
          "Construction materials and job site supplies. Home Depot, Lowe's, Menards, Ferguson, lumber yards, electrical/plumbing wholesalers.",
      },
      {
        name: "Subcontractors",
        accountType: "cost_of_goods_sold",
        description:
          "Payments to subcontractors on job sites. ACH, Zelle, checks to subs as 1099 contractors.",
      },
      {
        name: "Equipment Rental",
        accountType: "cost_of_goods_sold",
        description:
          "Rented job site equipment. Sunbelt Rentals, United Rentals, Home Depot tool rental.",
      },
      {
        name: "Vehicle & Fuel",
        accountType: "operating_expense",
        description:
          "Truck/van fuel, vehicle maintenance, repairs. Shell, BP, Exxon, Mobil, mechanic shops, tire purchases.",
      },
      {
        name: "Permits & Licensing",
        accountType: "operating_expense",
        description:
          "Building permits, inspections, licensing fees. Department of Buildings, town hall, county clerk fees.",
      },
      {
        name: "Insurance",
        accountType: "operating_expense",
        description:
          "General liability, workers' comp, commercial auto, builder's risk insurance.",
      },
    ],
  ),

  preset(
    "restaurant_food",
    "Restaurant / café / food service",
    "Restaurants, cafés, bakeries, food trucks, catering.",
    [
      {
        name: "Food & Beverage Sales",
        accountType: "income",
        description:
          "Revenue from food and beverage sales. Square, Toast, Clover payouts, DoorDash/Uber Eats/Grubhub payouts, dine-in card payments.",
      },
      {
        name: "Food & Ingredients",
        accountType: "cost_of_goods_sold",
        description:
          "Food ingredients and kitchen supplies. Restaurant Depot, US Foods, Sysco, local produce vendors, butchers.",
      },
      {
        name: "Beverage Costs",
        accountType: "cost_of_goods_sold",
        description:
          "Beverages: coffee beans, soft drinks, beer, wine, spirits. Beverage distributors, coffee roasters.",
      },
      {
        name: "Delivery Platform Fees",
        accountType: "cost_of_goods_sold",
        description:
          "Commissions from DoorDash, Uber Eats, Grubhub — usually a percentage deducted before payout.",
      },
      {
        name: "Payroll & Wages",
        accountType: "operating_expense",
        description:
          "Employee wages and tips. Gusto, ADP, Square Payroll. Look for 'GUSTO PAYROLL', 'ADP PAYROLL'.",
      },
      {
        name: "Rent & Utilities",
        accountType: "operating_expense",
        description:
          "Restaurant rent, electricity, gas, water. Recurring monthly bills from landlord and utilities.",
      },
    ],
  ),

  preset(
    "cleaning_janitorial",
    "Cleaning / janitorial services",
    "Residential and commercial cleaning companies.",
    [
      {
        name: "Cleaning Service Revenue",
        accountType: "income",
        description:
          "Revenue from cleaning jobs. Client payments via Stripe, Zelle, ACH, checks. Recurring contracts and one-time deep cleans.",
      },
      {
        name: "Cleaning Supplies",
        accountType: "cost_of_goods_sold",
        description:
          "Chemicals, mops, sponges, gloves, microfiber cloths. Costco, Sam's Club, Uline, janitorial supply houses.",
      },
      {
        name: "Subcontractor Cleaners",
        accountType: "cost_of_goods_sold",
        description:
          "Payments to independent cleaners hired per job. Zelle, Cash App, ACH to 1099 contractors.",
      },
      {
        name: "Vehicle & Fuel",
        accountType: "operating_expense",
        description:
          "Vehicle gas and maintenance for getting to job sites. Gas stations, oil changes.",
      },
      {
        name: "Insurance",
        accountType: "operating_expense",
        description:
          "General liability and bonding insurance for cleaning crews.",
      },
    ],
  ),

  preset(
    "landscaping_lawn",
    "Landscaping / lawn care",
    "Lawn care, landscaping installations, snow removal, tree services.",
    [
      {
        name: "Landscaping Revenue",
        accountType: "income",
        description:
          "Revenue from lawn maintenance, landscaping, snow plowing, tree work. Recurring client payments, seasonal contracts.",
      },
      {
        name: "Plants & Materials",
        accountType: "cost_of_goods_sold",
        description:
          "Mulch, soil, sod, plants, fertilizer. Lowe's Garden, Home Depot, local nurseries, mulch yards.",
      },
      {
        name: "Equipment Fuel & Maintenance",
        accountType: "cost_of_goods_sold",
        description:
          "Gas for mowers, blowers, trimmers. Repairs and parts. Stihl/Husqvarna dealers, gas stations, tractor supply.",
      },
      {
        name: "Subcontractor Labor",
        accountType: "cost_of_goods_sold",
        description:
          "Day laborers and seasonal workers. Cash, Zelle, checks to individual workers.",
      },
      {
        name: "Equipment Purchases",
        accountType: "operating_expense",
        description:
          "Mowers, blowers, trimmers, edgers. Home Depot, Lowe's, Stihl/Husqvarna dealers, Northern Tool.",
      },
      {
        name: "Insurance",
        accountType: "operating_expense",
        description:
          "General liability and commercial auto insurance.",
      },
    ],
  ),

  preset(
    "auto_repair",
    "Auto repair / mechanic shop",
    "Auto mechanics, body shops, oil change services, tire shops.",
    [
      {
        name: "Repair Revenue",
        accountType: "income",
        description:
          "Revenue from auto repair services: labor, diagnostics, inspections. Customer card/cash/check at the shop.",
      },
      {
        name: "Auto Parts",
        accountType: "cost_of_goods_sold",
        description:
          "Parts purchased for repair jobs. AutoZone, NAPA, O'Reilly, Advance Auto, Worldpac, dealer parts, Rock Auto.",
      },
      {
        name: "Shop Supplies",
        accountType: "cost_of_goods_sold",
        description:
          "Consumables: oil, grease, rags, fluids, cleaners.",
      },
      {
        name: "Tools & Equipment",
        accountType: "operating_expense",
        description:
          "Hand tools, diagnostic scanners, lifts. Snap-on, Mac Tools, Matco, Harbor Freight.",
      },
      {
        name: "Rent & Utilities",
        accountType: "operating_expense",
        description:
          "Shop rent, electricity, water. Recurring monthly bills.",
      },
      {
        name: "Insurance",
        accountType: "operating_expense",
        description:
          "Garage keepers, general liability, workers' comp insurance for auto shops.",
      },
    ],
  ),

  preset(
    "trucking_delivery",
    "Trucking / delivery / rideshare",
    "Owner-operator truckers, delivery, rideshare drivers, couriers.",
    [
      {
        name: "Delivery Revenue",
        accountType: "income",
        description:
          "Revenue from delivery, freight, or rideshare. Uber, Lyft, DoorDash, Instacart, Amazon Flex, freight broker payouts.",
      },
      {
        name: "Fuel",
        accountType: "cost_of_goods_sold",
        description:
          "Vehicle fuel: gas and diesel. Pilot, Flying J, TA, Loves, Shell, BP, Exxon, Chevron. Often the biggest cost.",
      },
      {
        name: "Truck Maintenance & Repairs",
        accountType: "cost_of_goods_sold",
        description:
          "Truck repairs, oil changes, tires, parts. Truck stops, Speedco, mechanic shops.",
      },
      {
        name: "Tolls",
        accountType: "cost_of_goods_sold",
        description:
          "Highway and bridge tolls. EZ-Pass, SunPass, FastTrak, IPass, state toll authorities.",
      },
      {
        name: "Insurance",
        accountType: "operating_expense",
        description:
          "Commercial auto insurance, cargo insurance, liability. Progressive Commercial, Geico Commercial.",
      },
      {
        name: "Permits & Licensing",
        accountType: "operating_expense",
        description:
          "DOT registration, IFTA fuel tax filings, IRP plates.",
      },
    ],
  ),

  preset(
    "rental_property",
    "Rental property / real estate investor",
    "Landlords, real estate investors, Airbnb/VRBO operators.",
    [
      {
        name: "Rental Income",
        accountType: "income",
        description:
          "Rent collected from tenants. ACH from tenants, Zelle rent, property manager disbursements, Airbnb/VRBO payouts.",
      },
      {
        name: "Property Tax",
        accountType: "operating_expense",
        description:
          "Annual property taxes paid to county/city assessor. 'COUNTY TAX', 'PROPERTY TAX', tax collector names.",
      },
      {
        name: "Repairs & Maintenance",
        accountType: "operating_expense",
        description:
          "Property repairs and maintenance. Plumber, HVAC, painting, Home Depot/Lowe's for parts.",
      },
      {
        name: "Property Management Fees",
        accountType: "operating_expense",
        description:
          "Fees paid to a property manager. Typically % of rent, often deducted before payout.",
      },
      {
        name: "Insurance",
        accountType: "operating_expense",
        description:
          "Landlord insurance, dwelling policy, umbrella coverage.",
      },
      {
        name: "Mortgage Interest",
        accountType: "operating_expense",
        description:
          "Interest portion of monthly mortgage payment. Principal portion goes to a Mortgage Payable liability account.",
      },
    ],
  ),

  preset(
    "healthcare_medical",
    "Healthcare / medical / dental practice",
    "Doctors, dentists, chiropractors, therapists, medical clinics.",
    [
      {
        name: "Patient Service Revenue",
        accountType: "income",
        description:
          "Insurance reimbursements and patient payments. Insurance ERAs, copays, deductibles, self-pay. Aetna, BCBS, UnitedHealthcare, Cigna, Medicare.",
      },
      {
        name: "Medical Supplies",
        accountType: "cost_of_goods_sold",
        description:
          "Disposable medical/dental supplies: gloves, syringes, dental materials. Henry Schein, Patterson Dental, McKesson, Medline.",
      },
      {
        name: "Payroll & Wages",
        accountType: "operating_expense",
        description:
          "Staff wages and payroll taxes. Gusto, ADP, Rippling, Paychex.",
      },
      {
        name: "Malpractice Insurance",
        accountType: "operating_expense",
        description:
          "Medical/dental malpractice and professional liability insurance.",
      },
      {
        name: "Licenses & Continuing Education",
        accountType: "operating_expense",
        description:
          "License renewals, DEA, CME courses, continuing dental education.",
      },
      {
        name: "Rent & Utilities",
        accountType: "operating_expense",
        description:
          "Office rent, electricity, water, internet.",
      },
    ],
  ),

  preset(
    "beauty_salon",
    "Beauty salon / barbershop / spa",
    "Hair salons, barbershops, nail salons, spas, lash studios.",
    [
      {
        name: "Service Revenue",
        accountType: "income",
        description:
          "Revenue from salon services. Square, Booksy, Vagaro, GlossGenius payouts, customer card payments.",
      },
      {
        name: "Product Sales",
        accountType: "income",
        description:
          "Retail sales of hair products, polish, skincare to clients.",
      },
      {
        name: "Salon Supplies",
        accountType: "cost_of_goods_sold",
        description:
          "Hair color, nail products, shampoo, single-use items. CosmoProf, Sally Beauty, SalonCentric.",
      },
      {
        name: "Commission to Stylists",
        accountType: "cost_of_goods_sold",
        description:
          "Commission paid to stylists, barbers, nail techs on commission. % of services rendered.",
      },
      {
        name: "Rent & Utilities",
        accountType: "operating_expense",
        description:
          "Salon rent, electricity, water. Recurring monthly bills.",
      },
      {
        name: "Booking Software",
        accountType: "operating_expense",
        description:
          "Booking platform fees. Mindbody, Vagaro, Booksy, GlossGenius monthly subscription.",
      },
    ],
  ),

  preset(
    "photography_creative",
    "Photography / videography / creative",
    "Photographers, videographers, content creators, designers.",
    [
      {
        name: "Service Revenue",
        accountType: "income",
        description:
          "Session fees, weddings, events, commercial shoots. Stripe, HoneyBook, Pixieset, ShootProof payouts.",
      },
      {
        name: "Print Lab Costs",
        accountType: "cost_of_goods_sold",
        description:
          "Prints and albums fulfilled by labs. WHCC, Miller's Lab, ProDPI, Bay Photo, Mpix.",
      },
      {
        name: "Equipment Rental",
        accountType: "cost_of_goods_sold",
        description:
          "Rented lenses, lights, cameras, studio space. BorrowLenses, LensRentals.",
      },
      {
        name: "Equipment Purchases",
        accountType: "operating_expense",
        description:
          "Cameras, lenses, lights, memory cards under capitalization threshold. B&H Photo, Adorama.",
      },
      {
        name: "Software & Subscriptions",
        accountType: "operating_expense",
        description:
          "Adobe Creative Cloud, editing software, gallery hosting (Pixieset, SmugMug), HoneyBook.",
      },
      {
        name: "Travel",
        accountType: "operating_expense",
        description:
          "Travel for shoots: flights, hotels, rideshare to job locations.",
      },
    ],
  ),

  preset(
    "real_estate_agent",
    "Real estate agent / broker",
    "Realtors, brokers, real estate teams.",
    [
      {
        name: "Commission Income",
        accountType: "income",
        description:
          "Commissions from real estate sales, paid by the brokerage after closing. Compass, Keller Williams, Coldwell Banker, RE/MAX, eXp Realty.",
      },
      {
        name: "Brokerage Splits & Desk Fees",
        accountType: "cost_of_goods_sold",
        description:
          "Brokerage split, transaction fees, desk fees retained by the brokerage.",
      },
      {
        name: "Lead Generation",
        accountType: "operating_expense",
        description:
          "Paid lead sources. Zillow Premier Agent, Realtor.com Connections, BoldLeads. Recurring monthly charges.",
      },
      {
        name: "MLS & Dues",
        accountType: "operating_expense",
        description:
          "MLS fees, NAR/state/local board dues, lockbox fees.",
      },
      {
        name: "Listing Marketing",
        accountType: "operating_expense",
        description:
          "Photography, drone, staging, signs, brochures for listings.",
      },
      {
        name: "Vehicle & Fuel",
        accountType: "operating_expense",
        description:
          "Vehicle fuel and maintenance for showing properties.",
      },
    ],
  ),

  preset(
    "nonprofit",
    "Nonprofit / 501(c)(3)",
    "Charities, foundations, religious orgs, community groups.",
    [
      {
        name: "Donations",
        accountType: "income",
        description:
          "Individual and corporate donations. Stripe donations, PayPal Giving Fund, DonorBox, Givebutter, Classy.",
      },
      {
        name: "Grants",
        accountType: "income",
        description:
          "Grants from foundations, corporations, or government. Often large lump sums tied to specific programs.",
      },
      {
        name: "Restricted Funds",
        accountType: "liability_current",
        description:
          "Donor-restricted funds not yet spent on their designated purpose. Required by FASB ASC 958.",
      },
      {
        name: "Program Expenses",
        accountType: "operating_expense",
        description:
          "Direct expenses delivering the nonprofit's mission. Program supplies, beneficiary support. Form 990 line.",
      },
      {
        name: "Fundraising Expenses",
        accountType: "operating_expense",
        description:
          "Costs to raise funds: events, donor mailings, fundraising software.",
      },
      {
        name: "Management & General",
        accountType: "operating_expense",
        description:
          "Administrative overhead: office, board governance, general administration.",
      },
    ],
  ),

  preset(
    "saas_tech_startup",
    "SaaS / tech startup",
    "Software companies, B2B SaaS, mobile apps with recurring revenue.",
    [
      {
        name: "Subscription Revenue",
        accountType: "income",
        description:
          "Recurring subscription (MRR/ARR) from customers. Stripe Billing, Chargebee, Recurly, Paddle payouts.",
      },
      {
        name: "Deferred Revenue",
        accountType: "liability_current",
        description:
          "Annual prepayments from customers not yet earned. Required under ASC 606.",
      },
      {
        name: "Hosting & Infrastructure",
        accountType: "cost_of_goods_sold",
        description:
          "AWS, GCP, Azure, Vercel, Cloudflare, Heroku, Supabase, MongoDB Atlas. Cloud compute, storage, bandwidth.",
      },
      {
        name: "Third-party APIs",
        accountType: "cost_of_goods_sold",
        description:
          "Paid APIs in the product: OpenAI, Anthropic, Twilio, SendGrid, Stripe (gateway), Intercom.",
      },
      {
        name: "Engineering Tools",
        accountType: "operating_expense",
        description:
          "GitHub, Linear, Sentry, Datadog, Posthog, JetBrains, dev tooling subscriptions.",
      },
      {
        name: "Payroll & Contractors",
        accountType: "operating_expense",
        description:
          "Employee payroll and contractor payments. Gusto, ADP, Rippling, Deel for international contractors.",
      },
    ],
  ),

  preset(
    "manufacturing",
    "Manufacturing / production",
    "Factories, fabrication shops, contract manufacturers.",
    [
      {
        name: "Product Sales",
        accountType: "income",
        description:
          "Revenue from manufactured products sold to distributors or direct.",
      },
      {
        name: "Raw Materials",
        accountType: "cost_of_goods_sold",
        description:
          "Direct material inputs: metal, plastic, components. McMaster-Carr, Grainger, mill suppliers.",
      },
      {
        name: "Direct Labor",
        accountType: "cost_of_goods_sold",
        description:
          "Wages for workers on the production line. Separated from admin payroll for accurate COGS.",
      },
      {
        name: "Factory Overhead",
        accountType: "cost_of_goods_sold",
        description:
          "Factory utilities, machine maintenance, factory supplies, factory rent allocation.",
      },
      {
        name: "Inventory",
        accountType: "asset_current",
        description:
          "Raw materials, work in process, and finished goods on hand. Balance sheet account updated via inventory counts.",
      },
      {
        name: "Equipment & Machinery",
        accountType: "asset_noncurrent",
        description:
          "Capitalized factory equipment, CNC machines, presses. Above capitalization threshold; depreciated.",
      },
    ],
  ),

  preset(
    "veterinary",
    "Veterinary clinic / animal hospital",
    "Vet clinics, animal hospitals, mobile vets.",
    [
      {
        name: "Service Revenue",
        accountType: "income",
        description:
          "Revenue from vet services: exams, surgery, vaccinations, dental. Clinic software payouts (eVetPractice, AVImark, Cornerstone).",
      },
      {
        name: "Pharmacy & Product Sales",
        accountType: "income",
        description:
          "Retail sales of medications, food, flea/tick to clients.",
      },
      {
        name: "Medical Supplies & Drugs",
        accountType: "cost_of_goods_sold",
        description:
          "Medical supplies and pharmaceuticals. Henry Schein, Patterson Veterinary, Covetrus, MWI.",
      },
      {
        name: "Lab & Diagnostics",
        accountType: "cost_of_goods_sold",
        description:
          "Outside lab and imaging. Idexx, Antech.",
      },
      {
        name: "Payroll & Wages",
        accountType: "operating_expense",
        description:
          "Vet techs and front desk wages. Gusto, ADP.",
      },
      {
        name: "Licensing & DEA",
        accountType: "operating_expense",
        description:
          "Vet license renewals, DEA controlled substance registration, AVMA dues.",
      },
    ],
  ),

  preset(
    "hotel_hospitality",
    "Hotel / B&B / hospitality",
    "Hotels, motels, B&Bs, vacation rentals run as a business.",
    [
      {
        name: "Room Revenue",
        accountType: "income",
        description:
          "Revenue from room nights sold. Booking.com, Expedia, Hotels.com payouts, direct reservations, Airbnb/VRBO.",
      },
      {
        name: "Food & Beverage Revenue",
        accountType: "income",
        description:
          "Revenue from on-site restaurant, bar, room service.",
      },
      {
        name: "OTA Commissions",
        accountType: "cost_of_goods_sold",
        description:
          "Commissions paid to OTAs. Booking.com, Expedia, Airbnb — typically 15-25% deducted before payout.",
      },
      {
        name: "Housekeeping Supplies",
        accountType: "cost_of_goods_sold",
        description:
          "Linens, towels, toiletries, cleaning chemicals per room turnover.",
      },
      {
        name: "Occupancy Tax Collected",
        accountType: "liability_current",
        description:
          "Hotel/lodging tax collected from guests, owed to the local jurisdiction.",
      },
      {
        name: "Payroll & Wages",
        accountType: "operating_expense",
        description:
          "Front desk, housekeeping, F&B staff wages.",
      },
    ],
  ),

  preset(
    "farm_agriculture",
    "Farm / agriculture",
    "Farms, ranches, orchards, livestock operations.",
    [
      {
        name: "Crop & Livestock Sales",
        accountType: "income",
        description:
          "Revenue from crop and livestock sales. Sales to elevators, auction barns, farmers markets, packers.",
      },
      {
        name: "Government Payments",
        accountType: "other_income",
        description:
          "USDA program payments, crop insurance proceeds, ARC/PLC. Look for 'USDA', 'FSA', 'NRCS'.",
      },
      {
        name: "Seed, Feed & Fertilizer",
        accountType: "cost_of_goods_sold",
        description:
          "Seeds, animal feed, fertilizer, herbicides. Co-ops, Tractor Supply, ag chemical dealers, feed mills.",
      },
      {
        name: "Vet & Breeding",
        accountType: "cost_of_goods_sold",
        description:
          "Vet bills, breeding services, livestock medications.",
      },
      {
        name: "Fuel & Lubricants",
        accountType: "operating_expense",
        description:
          "Off-road diesel, gas, oil, grease for farm equipment. Bulk fuel deliveries, ag co-op fuel.",
      },
      {
        name: "Farm Equipment",
        accountType: "asset_noncurrent",
        description:
          "Tractors, combines, implements above capitalization threshold. John Deere, Case IH, Kubota.",
      },
    ],
  ),

  preset(
    "childcare_daycare",
    "Childcare / daycare",
    "Daycare centers, in-home childcare, preschools.",
    [
      {
        name: "Tuition Income",
        accountType: "income",
        description:
          "Weekly or monthly tuition from parents. Brightwheel, Procare, HiMama payouts, state childcare subsidies.",
      },
      {
        name: "Food & Snacks",
        accountType: "cost_of_goods_sold",
        description:
          "Food and snacks for children. Costco, Sam's Club, Aldi runs.",
      },
      {
        name: "Educational Supplies",
        accountType: "operating_expense",
        description:
          "Curriculum, art supplies, books, toys. Lakeshore Learning, Discount School Supply.",
      },
      {
        name: "Payroll & Wages",
        accountType: "operating_expense",
        description:
          "Childcare staff wages. Gusto, ADP.",
      },
      {
        name: "Cleaning & Sanitization",
        accountType: "operating_expense",
        description:
          "Disinfectant, wipes, paper products — higher volume due to childcare regulations.",
      },
      {
        name: "Licensing & Background Checks",
        accountType: "operating_expense",
        description:
          "State childcare licensing, staff background checks, CPR/first aid training.",
      },
    ],
  ),

  preset(
    "law_firm",
    "Law firm / attorney",
    "Solo practitioners and small firms. Includes IOLTA trust accounting.",
    [
      {
        name: "Legal Fees Earned",
        accountType: "income",
        description:
          "Earned legal fees: hourly billing, flat fees, contingency settlements.",
      },
      {
        name: "IOLTA Trust Account",
        accountType: "asset_current",
        description:
          "Interest on Lawyer Trust Account for client funds. MUST stay separate from operating — state bar mandate.",
      },
      {
        name: "Client Trust Liabilities",
        accountType: "liability_current",
        description:
          "Offsetting liability for IOLTA funds held on behalf of clients. Must always equal IOLTA balance.",
      },
      {
        name: "Filing & Court Fees",
        accountType: "cost_of_goods_sold",
        description:
          "Court filing fees, service of process, PACER. Usually reimbursed by clients.",
      },
      {
        name: "Legal Research",
        accountType: "operating_expense",
        description:
          "Westlaw, LexisNexis, Fastcase, Casetext subscriptions.",
      },
      {
        name: "Malpractice Insurance & Bar Dues",
        accountType: "operating_expense",
        description:
          "Lawyer professional liability, state bar dues, CLE.",
      },
    ],
  ),

  preset(
    "fitness_gym",
    "Fitness studio / gym / personal training",
    "Gyms, yoga studios, CrossFit boxes, personal trainers, martial arts.",
    [
      {
        name: "Membership Revenue",
        accountType: "income",
        description:
          "Recurring monthly or annual memberships. Mindbody, ClassPass, Glofox, Zen Planner payouts.",
      },
      {
        name: "Class & PT Revenue",
        accountType: "income",
        description:
          "Drop-in classes, class packs, personal training sessions.",
      },
      {
        name: "Instructor Pay",
        accountType: "cost_of_goods_sold",
        description:
          "Per-class instructor payments, often paid as 1099 contractors.",
      },
      {
        name: "Studio Equipment",
        accountType: "operating_expense",
        description:
          "Mats, weights, kettlebells, resistance bands. Rogue Fitness, Rep Fitness.",
      },
      {
        name: "Booking Software",
        accountType: "operating_expense",
        description:
          "Mindbody, Glofox, Wodify, Zen Planner monthly subscription.",
      },
      {
        name: "Rent & Utilities",
        accountType: "operating_expense",
        description:
          "Studio rent, electricity, water, internet.",
      },
    ],
  ),

  preset(
    "generic_other",
    "Generic / other business",
    "Catch-all minimum CoA. Pick this if no other preset fits.",
    [
      {
        name: "Sales Revenue",
        accountType: "income",
        description:
          "General revenue from sales of products or services.",
      },
      {
        name: "Cost of Goods Sold",
        accountType: "cost_of_goods_sold",
        description:
          "Direct cost of producing or buying what was sold.",
      },
      {
        name: "Software & Subscriptions",
        accountType: "operating_expense",
        description:
          "SaaS tools and recurring software subscriptions.",
      },
      {
        name: "Office Expenses",
        accountType: "operating_expense",
        description:
          "Office rent, utilities, supplies, internet.",
      },
    ],
  ),
]

export function getPresetById(id) {
  const found = PRESETS.find((p) => p.id === id)
  if (!found) return null
  return {
    id: found.id,
    label: found.label,
    description: found.description,
    accounts: found.accounts.map((a) => ({ ...a })),
  }
}

export function listPresetSummaries() {
  return PRESETS.map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    accountCount: p.accounts.length,
  }))
}
