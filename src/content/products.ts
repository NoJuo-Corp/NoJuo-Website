export interface Product {
  slug: string;
  name: string;
  tagline: string;
  status: string;
  summary: string;
  details: string[];
  facts: [string, string][];
}

/* Edit this file to change the product pages; nothing else needs to change. */
export const products: Product[] = [
  {
    slug: "horizonos",
    name: "HorizonOS",
    tagline: "An NT-style operating system, written from scratch.",
    status: "In development",
    summary: "A 64-bit operating system with its own kernel, window manager, file systems and applications.",
    details: [
      "HorizonOS follows the architecture of the Windows NT family: a hardware abstraction layer, an executive with object, memory, process and I/O managers, a win32k-style window manager and a user-mode desktop shell.",
      "It boots from UEFI with Limine and runs on QEMU and VirtualBox. It has its own journaled file system (HZFS) next to FAT32, a compositing window manager, an HTTPS-capable web stack and a set of built-in applications.",
      "Sign in with your NoJuo account from HorizonOS using the account tool; see the developer page for the API.",
    ],
    facts: [["Platform", "x86-64, UEFI"], ["Kernel", "C and C++, with a Rust region library"], ["File systems", "HZFS, FAT32"], ["Builds", "fre (release) and chk (checked)"]],
  },
  {
    slug: "kopaqop",
    name: "KopaQop",
    tagline: "A messaging app.",
    status: "In development",
    summary: "A messaging app that starts on Windows, with Android and iOS to follow.",
    details: ["KopaQop starts with a Windows client; Android and iOS clients follow."],
    facts: [["First platform", "Windows"], ["Later", "Android, iOS"]],
  },
  {
    slug: "snow-code",
    name: "Snow Code",
    tagline: "An AI coding assistant for the command line.",
    status: "In development",
    summary: "A command-line AI coding assistant with its core tools built in.",
    details: [
      "Snow Code is written in TypeScript on Node. It starts with an Anthropic backend and ships its core tools built in.",
    ],
    facts: [["Runtime", "Node.js"], ["Language", "TypeScript"], ["First backend", "Anthropic"]],
  },
  {
    slug: "mooste",
    name: "Mooste",
    tagline: "A game engine.",
    status: "In development",
    summary: "NoJuo's own game engine.",
    details: ["Mooste is NoJuo's own game engine. More details will appear here as it takes shape."],
    facts: [["Type", "Game engine"]],
  },
];

export function findProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}
