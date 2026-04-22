import Scene from "@/components/Scene";

export default function Home() {
  return (
    <div className="scroll-container">
      <Scene />
      {/* Scroll hint */}
      <div className="scroll-hint">
        <span>scroll</span>
        <div className="scroll-hint-arrow" />
      </div>
      {/* Scroll space for 3-phase animation */}
      <div className="scroll-space" />
    </div>
  );
}
