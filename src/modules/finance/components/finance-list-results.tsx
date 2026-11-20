"use client";

import { Component, createRef, type ReactNode } from "react";

type Props = { busy: boolean; children: ReactNode };

export class FinanceListResults extends Component<Props> {
  private region = createRef<HTMLDivElement>();

  getSnapshotBeforeUpdate(previous: Props) {
    // Measure the settled list before React replaces it with loading content.
    if (this.props.busy && !previous.busy)
      return this.region.current?.getBoundingClientRect().height ?? null;
    return null;
  }

  componentDidUpdate(previous: Props, _state: unknown, height: number | null) {
    const region = this.region.current;
    if (!region) return;
    if (height !== null) region.style.blockSize = `${height}px`;
    else if (previous.busy && !this.props.busy) region.style.removeProperty("block-size");
  }

  render() {
    return <div ref={this.region} className="finance-list-results" aria-busy={this.props.busy}>
      {this.props.children}
    </div>;
  }
}
