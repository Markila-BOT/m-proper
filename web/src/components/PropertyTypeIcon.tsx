// web/src/components/PropertyTypeIcon.tsx
// Renders the correct icon for a property type
import { PROPERTY_TYPE } from "#/lib/domain";
import { FiHome } from "react-icons/fi";
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import { MdLandscape } from "react-icons/md";

// Type for property type value
export type PropertyType = (typeof PROPERTY_TYPE)[keyof typeof PROPERTY_TYPE];

export type PropertyTypeIconProps = {
  type: PropertyType;
  className?: string;
  size?: number | string;
  color?: string;
};

export function PropertyTypeIcon({
  type,
  className,
  size = 24,
  color,
}: PropertyTypeIconProps) {
  switch (type) {
    case PROPERTY_TYPE.RESIDENTIAL:
      return <FiHome className={className} size={size} color={color} />;
    case PROPERTY_TYPE.COMMERCIAL:
      return (
        <HiOutlineOfficeBuilding
          className={className}
          size={size}
          color={color}
        />
      );
    case PROPERTY_TYPE.LOT:
      return <MdLandscape className={className} size={size} color={color} />;
    default:
      return <FiHome className={className} size={size} color={color} />;
  }
}
