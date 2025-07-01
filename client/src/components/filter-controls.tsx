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
    <div className="fixed bottom-3 sm:bottom-6 left-2 sm:left-6 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl p-3 sm:p-4 opacity-100 transition-opacity duration-500 z-30 max-w-[calc(100vw-1rem)] sm:max-w-none">
      <h3 className="text-xs sm:text-sm font-semibold text-gray-300 mb-2 sm:mb-3">Filter by Type</h3>
      <div className="space-y-2 sm:space-y-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Checkbox
            id="showArtists"
            checked={filterState.showArtists}
            onCheckedChange={(checked) =>
              handleFilterChange("showArtists", !!checked)
            }
            className="data-[state=checked]:border-[#FF0ACF] h-4 w-4 sm:h-5 sm:w-5"
            style={{ backgroundColor: filterState.showArtists ? '#FF0ACF' : 'transparent' }}
          />
          <Label htmlFor="showArtists" className="text-xs sm:text-sm text-white cursor-pointer flex items-center gap-1 sm:gap-2">
            Artists
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full" style={{ backgroundColor: '#FF0ACF' }}></div>
          </Label>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Checkbox
            id="showProducers"
            checked={filterState.showProducers}
            onCheckedChange={(checked) =>
              handleFilterChange("showProducers", !!checked)
            }
            className="data-[state=checked]:border-[#AE53FF] h-4 w-4 sm:h-5 sm:w-5"
            style={{ backgroundColor: filterState.showProducers ? '#AE53FF' : 'transparent' }}
          />
          <Label htmlFor="showProducers" className="text-xs sm:text-sm text-white cursor-pointer flex items-center gap-1 sm:gap-2">
            Producers
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full" style={{ backgroundColor: '#AE53FF' }}></div>
          </Label>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Checkbox
            id="showSongwriters"
            checked={filterState.showSongwriters}
            onCheckedChange={(checked) =>
              handleFilterChange("showSongwriters", !!checked)
            }
            className="data-[state=checked]:border-[#67D1F8] h-4 w-4 sm:h-5 sm:w-5"
            style={{ backgroundColor: filterState.showSongwriters ? '#67D1F8' : 'transparent' }}
          />
          <Label htmlFor="showSongwriters" className="text-xs sm:text-sm text-white cursor-pointer flex items-center gap-1 sm:gap-2">
            Songwriters
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full" style={{ backgroundColor: '#67D1F8' }}></div>
          </Label>
        </div>
      </div>
    </div>
  );
}
