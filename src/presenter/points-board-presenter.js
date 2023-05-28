import SortView from '../view/sorting-view.js';
import PointsListView from '../view/trip-point-list-view.js';
// import PointCreationView from '../view/trip-point-creation-view.js';
import TripPointPresenter from './trip-point-presenter.js';
import NoPointsView from '../view/no-points-view.js';
import { remove, render, RenderPosition } from '../framework/render.js';
import { SortType, UpdateType, UserAction } from '../const.js';
import { sortTime, sortPrice } from '../utils/sorter.js';

export default class PointsBoardPresenter {
  #container = null;
  #tripPointsModel = null;
  #tripPointsPresenters = new Map();
  #sortComponent = null;
  #pointsListComponent = new PointsListView();
  #noPointsComponent = new NoPointsView();
  #currentSortType = SortType.DAY;

  constructor({ container, tripPointsModel }) {
    this.#container = container;
    this.#tripPointsModel = tripPointsModel;
    this.#tripPointsModel.addObserver(this.#handleModelEvent);
  }

  get tripPoints() {
    switch (this.#currentSortType) {
      case SortType.TIME:
        return [...this.#tripPointsModel.tripPoints].sort(sortTime);
      case SortType.PRICE:
        return [...this.#tripPointsModel.tripPoints].sort(sortPrice);
    }
    return this.#tripPointsModel.tripPoints;
  }

  init() {
    this.#renderPointsBoard();
  }

  #renderPointsBoard() {
    const currentFilter = document.querySelector(
      'input[name="trip-filter"]:checked'
    );
    const currentFilterPointsAmount = currentFilter.dataset.tripPointsAmount;
    if (currentFilterPointsAmount !== '0') {
      this.#renderSortComponent();
      this.#renderTripPoints();
    } else {
      this.#renderNoPointsMessage(currentFilter.value.toUpperCase());
    }
  }

  #renderNoPointsMessage(currentFilter) {
    this.#noPointsComponent.activeFilter = currentFilter;
    render(this.#noPointsComponent, this.#container);
  }

  #renderTripPoints() {
    this.#renderPointsListComponent();
    for (let i = 0; i < this.#tripPointsModel.tripPoints.length; i++) {
      this.#renderTripPoint(
        this.#tripPointsModel.tripPoints[i],
        this.#pointsListComponent
      );
    }
  }

  #renderTripPoint(tripPoint, tripPointsContainer) {
    const tripPointPresenter = new TripPointPresenter({
      container: tripPointsContainer,
      onDataChange: this.#handleViewAction,
      onModeChange: this.#handleModeChange,
    });
    tripPointPresenter.init(tripPoint);
    this.#tripPointsPresenters.set(tripPoint.id, tripPointPresenter);
  }

  #renderSortComponent() {
    this.#sortComponent = new SortView({
      sortTypes: SortType,
      onSortTypeChange: this.#handleSortTypeChange,
      currentSorter: this.#currentSortType,
    });
    render(this.#sortComponent, this.#container, RenderPosition.AFTERBEGIN);
  }

  #renderPointsListComponent() {
    render(this.#pointsListComponent, this.#container);
  }

  #clearPointsBoard({ resetSortType = false } = {}) {
    this.#tripPointsPresenters.forEach((presenter) => presenter.destroy());
    this.#tripPointsPresenters.clear();
    remove(this.#sortComponent);
    remove(this.#noPointsComponent);
    if (resetSortType) {
      this.#currentSortType = SortType.DEFAULT;
    }
  }

  #handleModeChange = () => {
    this.#tripPointsPresenters.forEach((presenter) => presenter.resetView());
  };

  #handleSortTypeChange = (sortType) => {
    if (this.#currentSortType === sortType) {
      return;
    }
    this.#currentSortType = sortType;
    this.#clearPointsBoard();
    this.#renderPointsBoard();
  };

  #handleModelEvent = (updateType, data) => {
    switch (updateType) {
      case UpdateType.PATCH:
        this.#tripPointsPresenters.get(data.id).init(data);
        break;
      case UpdateType.MINOR:
        this.#clearPointsBoard();
        this.#renderPointsBoard();
        break;
      case UpdateType.MAJOR:
        this.#clearPointsBoard({ resetSortType: true });
        this.#renderPointsBoard();
        break;
    }
  };

  #handleViewAction = (actionType, updateType, update) => {
    switch (actionType) {
      case UserAction.UPDATE_TRIP_POINT:
        this.#tripPointsModel.updateTripPoint(updateType, update);
        break;
      case UserAction.ADD_TRIP_POINT:
        this.#tripPointsModel.addTripPoint(updateType, update);
        break;
      case UserAction.DELETE_TRIP_POINT:
        this.#tripPointsModel.deleteTripPoint(updateType, update);
        break;
    }
  };
}
