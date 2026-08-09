export function MiniMap({ label = "Улаанбаатар live dispatch" }: { label?: string }) {
  return (
    <div className="map">
      <span className="road road-one" />
      <span className="road road-two" />
      <span className="road road-three" />
      <span className="pin pin-a">1</span>
      <span className="pin pin-b">2</span>
      <span className="pin pin-c">3</span>
      <span className="courier-dot" />
      <div className="map-label">{label}</div>
    </div>
  );
}
