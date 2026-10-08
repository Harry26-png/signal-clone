"use client";

import { forwardRef } from "react";
import { CloseIcon, FilterIcon, SearchIcon } from "@/components/common/icons";
import styles from "./sidebar.module.css";

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  filterActive?: boolean;
  onToggleFilter?: () => void;
  autoFocus?: boolean;
}

export const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(function SearchBox(
  { value, onChange, placeholder = "Search", filterActive, onToggleFilter, autoFocus },
  ref,
) {
  return (
    <div className={styles.searchWrap}>
      <div className={styles.search}>
        <SearchIcon size={16} />
        <input
          ref={ref}
          className={styles.searchInput}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && value) {
              e.stopPropagation();
              onChange("");
            }
          }}
          autoFocus={autoFocus}
          aria-label={placeholder}
        />
        {value && (
          <button className={styles.searchButton} onClick={() => onChange("")} aria-label="Clear search">
            <CloseIcon size={14} />
          </button>
        )}
        {onToggleFilter && (
          <button
            className={styles.searchButton}
            onClick={onToggleFilter}
            aria-pressed={!!filterActive}
            aria-label="Filter by unread"
            title="Filter by unread"
          >
            <FilterIcon size={16} />
          </button>
        )}
      </div>
    </div>
  );
});
