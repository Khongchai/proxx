/**
 * Copyright 2019 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Remote } from "comlink/src/comlink.js";
import { Component, ComponentFactory, h, render } from "preact";
import { Cell, GridChanges } from "../../gamelogic/types.js";
import StateService, { State as GameState, StateName } from "../state/index.js";
import initialState from "../state/initial-state.js";
import localStateSubscribe from "../state/local-state-subscribe.js";
import Intro from "./components/intro/index.js";
import ResolveComponent from "./components/resolve/index.js";

interface Props {
  stateService: Remote<StateService>;
}

interface State {
  state: GameState;
}

export type GridChangeSubscriptionCallback = (gridChanges: GridChanges) => void;

class PreactService extends Component<Props, State> {
  state: State = { state: { ...initialState } };

  private gridChangeSubscribers = new Set<GridChangeSubscriptionCallback>();

  constructor(props: Props) {
    super(props);

    localStateSubscribe(props.stateService, (newState, gridChanges) => {
      if (gridChanges) {
        this.gridChangeSubscribers.forEach(f => f(gridChanges));
      }
      this.setState({ state: newState });
    });
  }

  render({ stateService }: Props, { state }: State) {
    if (!state || !("name" in state)) {
      // This would delete the entire DOM in <main>,
      // so we need to avoid it at all costs for a stable
      // prerender. That’s what the `await stateService.ready` in
      // `game()` is for.
      return null;
    }
    switch (state.name) {
      case StateName.START:
        return <Intro stateService={stateService} />;
      case StateName.WAITING_TO_PLAY:
      case StateName.PLAYING:
        return (
          <ResolveComponent<
            ComponentFactory<import("./components/game/index.js").Props>
          >
            promise={import("./components/game/index.js").then(m => m.default)}
            // tslint:disable-next-line:variable-name Need uppercase for JSX
            onResolve={Game => (
              // TODO: Implement an unsubscribe for when the unmounting happens
              <Game
                grid={state.grid}
                gridChangeSubscribe={(f: GridChangeSubscriptionCallback) =>
                  this.gridChangeSubscribers.add(f)
                }
                stateService={stateService}
              />
            )}
          />
        );
      case StateName.END:
        return (
          <ResolveComponent<
            ComponentFactory<import("./components/end/index.js").Props>
          >
            promise={import("./components/end/index.js").then(m => m.default)}
            // tslint:disable-next-line:variable-name Need uppercase for JSX
            onResolve={End => (
              <End type={state.endType} restart={() => stateService.reset()} />
            )}
          />
        );
    }
  }
}

export async function game(stateService: Remote<StateService>) {
  const container = document.body.querySelector("main")!;
  render(
    <PreactService stateService={stateService} />,
    container,
    container.firstChild as any
  );
  performance.mark("UI ready");
}
