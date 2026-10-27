import Link from "next/link";
import { products } from "@/content/products";

export default function Home() {
  return (
    <>
      <section className="hero wrap">
        <h1>Software, built from the ground up.</h1>
        <p className="lead">NoJuo makes an operating system, a messaging app, an AI coding assistant and a game engine.</p>
        <p>
          <Link className="btn" href="/products/horizonos">Meet HorizonOS</Link>{" "}
          <Link className="btn secondary" href="/signup">Create an account</Link>
        </p>
      </section>
      <section className="wrap" id="products" aria-labelledby="products-title">
        <h2 id="products-title" style={{ marginTop: 0 }}>Products</h2>
        <div className="grid">
          {products.map((p) => (
            <Link key={p.slug} href={`/products/${p.slug}`} className="card">
              <span className="badge">{p.status}</span>
              <h3>{p.name}</h3>
              <p>{p.summary}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
