import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FilterState } from "@/types/network";

interface FilterControlsProps {
  filterState: FilterState;
  onFilterChange: (newState: FilterState) => void;
}

export default function FilterControls({
  filterState,
  onFilterChange,
}: FilterControlsProps) {
  const handleFilterChange = (type: keyof FilterState, checked: boolean) => {
    onFilterChange({
      ...filterState,
      [type]: checked,
    });
  };

  return (
    <div className="fixed top-6 left-6 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl p-4 opacity-100 transition-opacity duration-500 z-30">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Filter by Type</h3>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Checkbox
            id="showProducers"
            checked={filterState.showProducers}
            onCheckedChange={(checked) =>
              handleFilterChange("showProducers", !!checked)
            }
            className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
          />
          <Label htmlFor="showProducers" className="text-sm text-white cursor-pointer flex items-center gap-2">
            Producers
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          </Label>
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id="showSongwriters"
            checked={filterState.showSongwriters}
            onCheckedChange={(checked) =>
              handleFilterChange("showSongwriters", !!checked)
            }
            className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
          />
          <Label htmlFor="showSongwriters" className="text-sm text-white cursor-pointer flex items-center gap-2">
            Songwriters
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          </Label>
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id="showArtists"
            checked={filterState.showArtists}
            onCheckedChange={(checked) =>
              handleFilterChange("showArtists", !!checked)
            }
            className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
          />
          <Label htmlFor="showArtists" className="text-sm text-white cursor-pointer flex items-center gap-2">
            Artists
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          </Label>
        </div>
      </div>
    </div>
  );
}
