import Stripe from "stripe";
export const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY!);
