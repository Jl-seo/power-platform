// PCF: Rating control — 1~5 별점 + hover.
// PowerApps Component Framework lifecycle: init / updateView / getOutputs / destroy.

import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class Rating implements ComponentFramework.StandardControl<IInputs, IOutputs> {
  private _container!: HTMLDivElement;
  private _value = 0;
  private _max = 5;
  private _readOnly = false;
  private _notifyOutputChanged!: () => void;

  public init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    state: ComponentFramework.Dictionary,
    container: HTMLDivElement,
  ): void {
    this._container = container;
    this._notifyOutputChanged = notifyOutputChanged;
    this._value = context.parameters.value.raw ?? 0;
    this._max = context.parameters.max.raw ?? 5;
    this._readOnly = !!context.parameters.readOnly.raw;
    this.render();
  }

  public updateView(context: ComponentFramework.Context<IInputs>): void {
    this._value = context.parameters.value.raw ?? this._value;
    this._max = context.parameters.max.raw ?? this._max;
    this._readOnly = !!context.parameters.readOnly.raw;
    this.render();
  }

  public getOutputs(): IOutputs {
    return { value: this._value };
  }

  public destroy(): void {
    this._container.replaceChildren();
  }

  private render(): void {
    this._container.replaceChildren();
    this._container.classList.add("dk-rating");
    for (let i = 1; i <= this._max; i++) {
      const star = document.createElement("button");
      star.type = "button";
      star.className = "dk-rating__star" + (i <= this._value ? " is-on" : "");
      star.setAttribute("aria-label", `${i}점`);
      star.textContent = "★";
      star.disabled = this._readOnly;
      if (!this._readOnly) {
        star.addEventListener("click", () => {
          this._value = i;
          this._notifyOutputChanged();
          this.render();
        });
        star.addEventListener("mouseenter", () => this.preview(i));
        star.addEventListener("mouseleave", () => this.render());
      }
      this._container.appendChild(star);
    }
  }

  private preview(n: number): void {
    const stars = this._container.querySelectorAll<HTMLButtonElement>(".dk-rating__star");
    stars.forEach((s, idx) => {
      s.classList.toggle("is-preview", idx < n);
    });
  }
}
