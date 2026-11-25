"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import { normalizeCategoryName } from "../utils/finance-category-name";
import { FinanceFieldPopup } from "./finance-field-popup";
import styles from "./finance-pickers.module.css";

type Choice = { value: string; text: string };

export function FinanceSelect({
  label,
  children,
  hideLabel,
  fieldClassName,
  popupWidth,
  renderValue,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hideLabel?: boolean;
  fieldClassName?: string;
  popupWidth?: number;
  renderValue?: (value: string) => ReactNode;
}) {
  const id = useId();
  const select = useRef<HTMLSelectElement>(null);
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const handledTouch = useRef(false);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const open = choices !== null;
  const searchable = (choices?.length ?? 0) > 8;
  const visible =
    choices?.filter((option) =>
      normalizeCategoryName(option.text).includes(normalizeCategoryName(query)),
    ) ?? [];

  function show() {
    const field = select.current;
    if (!field || field.matches(":disabled")) return;
    const options = Array.from(field.options)
      .filter((option) => !option.disabled)
      .map(({ value, text }) => ({ value, text }));
    setSelected(field.value);
    setChoices(options);
    setQuery("");
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === field.value),
      ),
    );
  }
  function choose(choice: Choice) {
    const field = select.current;
    if (!field || field.matches(":disabled")) return;
    field.value = choice.value;
    field.dispatchEvent(new Event("change", { bubbles: true }));
    setChoices(null);
    field.focus();
  }
  useEffect(() => {
    if (open) (search.current ?? list.current)?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (open)
      list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open, query]);

  function navigate(event: KeyboardEvent) {
    const last = visible.length - 1;
    switch (event.key) {
      case "ArrowDown":
        setActive(Math.min(active + 1, last));
        break;
      case "ArrowUp":
        setActive(Math.max(0, active - 1));
        break;
      case "Home":
        if (event.target === search.current) return;
        setActive(0);
        break;
      case "End":
        if (event.target === search.current) return;
        setActive(last);
        break;
      case "Enter":
        if (visible[active]) choose(visible[active]);
        break;
      case " ":
        if (searchable) return;
        if (visible[active]) choose(visible[active]);
        break;
      case "Tab":
        select.current?.focus();
        setChoices(null);
        return;
      default: {
        if (
          searchable ||
          event.key.length !== 1 ||
          event.ctrlKey ||
          event.metaKey
        )
          return;
        const next = visible.findIndex((option) =>
          normalizeCategoryName(option.text).startsWith(
            normalizeCategoryName(event.key),
          ),
        );
        if (next >= 0) setActive(next);
        break;
      }
    }
    event.preventDefault();
  }
  const activeId = visible[active] ? id + "-item-" + active : undefined;
  return (
    <div className={[styles.field, "finance-picker-field", fieldClassName].filter(Boolean).join(" ")}>
      {!hideLabel && <label htmlFor={id}>{label}</label>}
      <div className={styles.control}>
        <select
          aria-label={hideLabel ? label : undefined}
          {...props}
          data-rich={renderValue ? true : undefined}
          ref={select}
          id={id}
          aria-expanded={open}
          aria-controls={open ? id + "-list" : undefined}
          onPointerDown={(event) => {
            handledTouch.current = false;
            if (event.button === 0) event.preventDefault();
          }}
          onPointerUp={(event) => {
            // WebKit may finish a touch on a select without dispatching a click.
            if (event.pointerType !== "touch") return;
            handledTouch.current = true;
            if (open) setChoices(null);
            else show();
          }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.preventDefault();
            if (handledTouch.current && event.detail > 0) return;
            if (open) setChoices(null);
            else show();
          }}
          onKeyDown={(event) => {
            if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
              event.preventDefault();
              show();
            }
          }}
        >
          {children}
        </select>
        {renderValue && <span aria-hidden="true" className={styles.selectedContent}>{renderValue(String(props.value ?? ""))}</span>}
        <ChevronDown size={17} aria-hidden="true" className={styles.chevron} />
      </div>
      {open && (
        <FinanceFieldPopup anchor={select} width={popupWidth} onDismiss={() => setChoices(null)}>
          <div onKeyDown={navigate}>
            {searchable && (
              <input
                ref={search}
                role="combobox"
                aria-expanded="true"
                aria-controls={id + "-list"}
                aria-activedescendant={activeId}
                aria-autocomplete="list"
                aria-label={`Buscar em ${label}`}
                placeholder="Buscar opção"
                value={query}
                onChange={(event) => {
                  event.stopPropagation();
                  setQuery(event.target.value);
                  setActive(0);
                }}
              />
            )}
            <div
              id={id + "-list"}
              role="listbox"
              aria-label={label}
              ref={list}
              tabIndex={-1}
              aria-activedescendant={searchable ? undefined : activeId}
              className={styles.options}
            >
              {visible.map((option, i) => (
                <div
                  role="option"
                  aria-label={renderValue ? option.text : undefined}
                  id={id + "-item-" + i}
                  key={option.value}
                  aria-selected={option.value === selected}
                  data-active={active === i}
                  className={styles.option}
                  onPointerMove={(event) => {
                    if (event.pointerType === "mouse") setActive(i);
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  {renderValue ? renderValue(option.value) : option.text}
                  {option.value === selected && (
                    <Check size={16} aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
            {!visible.length && (
              <p role="status" className={styles.empty}>
                Nenhuma opção encontrada.
              </p>
            )}
          </div>
        </FinanceFieldPopup>
      )}
    </div>
  );
}
