import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { Chat, FaqSection } from "./components/cosign/Chat";
import { BuildLog, UnderTheHood } from "./components/cosign/Deep";
import { Demo } from "./components/cosign/Demo";
import { TwoDoors } from "./components/cosign/Doors";
import { LiveEngine } from "./components/cosign/LiveEngine";
import { Journey } from "./components/cosign/Journey";
import { Footer, GoToMarket, Hero, How, Landscape, Metrics, Nav, Problem, Sources, Who } from "./components/cosign/Sections";

function Index() {
  return (
    <>
      <a href="#demo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-card focus:p-2">Skip to demo</a>
      <div role="note" className="bg-[#fbf0c9] px-4 py-2.5 text-center text-[13px] leading-snug text-ink sm:text-sm">
        <span className="mr-2 rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#e8c766]">Early prototype</span>
        <strong>Not a launched product.</strong> Built part-time alongside my college studies to test the idea. Users, banks and money are simulated.
      </div>
      <Nav />
      <main>
        <Hero />
        <Journey />
        <Problem />
        <TwoDoors />
        <How />
        <UnderTheHood />
        <LiveEngine />
        <Demo />
        <Landscape />
        <Who />
        <Metrics />
        <GoToMarket />
        <BuildLog />
        <FaqSection />
        <Sources />
      </main>
      <Footer />
      <Chat />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Index /></StrictMode>);
