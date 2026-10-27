import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findProduct, products } from "@/content/products";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = findProduct((await params).slug);
  return product ? { title: product.name, description: product.summary } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = findProduct((await params).slug);
  if (!product) notFound();
  return (
    <article className="narrow" style={{ paddingTop: 56 }}>
      <p><Link href="/#products">&larr; All products</Link></p>
      <span className="badge">{product.status}</span>
      <h1>{product.name}</h1>
      <p style={{ fontSize: "1.2rem", color: "var(--muted)" }}>{product.tagline}</p>
      {product.details.map((d) => <p key={d}>{d}</p>)}
      <dl className="facts">
        {product.facts.map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {product.slug === "horizonos" && <p><Link className="btn secondary" href="/developers">Account API for HorizonOS</Link></p>}
    </article>
  );
}
