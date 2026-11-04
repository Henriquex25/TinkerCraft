import appIcon from "../../build/appicon-small.png";

export function BrandIcon({ title }: { title?: string }) {
  return (
    <div className="brand-symbol" title={title}>
      <img src={appIcon} alt="TinkerCraft" draggable={false} />
    </div>
  );
}
