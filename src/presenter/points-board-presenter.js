import SortView from '../view/sorting-view.js';
import PointsListView from '../view/trip-point-list-view.js';
import NewTripPointPresenter from './new-point-presenter.js';
import TripPointPresenter from './trip-point-presenter.js';
import NoPointsView from '../view/no-points-view.js';
import LoadingView from '../view/loading-view.js';
import { remove, render, RenderPosition } from '../framework/render.js';
import { SortType, UpdateType, UserAction, FilterType } from '../const.js';
import { sortTime, sortPrice, sortDate } from '../utils/sorter.js';
import { filter } from '../utils/filter.js';
import UiBlocker from '../framework/ui-blocker/ui-blocker.js';

const TimeLimit = {
  LOWER_LIMIT: 350,
  UPPER_LIMIT: 1000,
};

export default class PointsBoardPresenter {
  #container = null;
  #tripPointsModel = null;
  #tripPointsPresenters = new Map();
  #sortComponent = null;
  #pointsListComponent = new PointsListView();
  #noPointsComponent = null;
  #loadingComponent = new LoadingView();
  #currentSortType = SortType.DAY;
  #filterModel = null;
  #filterType = FilterType.EVERYTHING;
  #newTripPointPresenter = null;
  #isLoading = true;
  #newTripPointButton = document.querySelector('.trip-main__event-add-btn');
  #uiBlocker = new UiBlocker({
    lowerLimit: TimeLimit.LOWER_LIMIT,
    upperLimit: TimeLimit.UPPER_LIMIT,
  });

  constructor({ container, tripPointsModel, filterModel }) {
    this.#container = container;
    this.#tripPointsModel = tripPointsModel;
    this.#filterModel = filterModel;
    this.#newTripPointButton.addEventListener('click', () =>
      this.createTripPoint()
    );
    this.#newTripPointPresenter = new NewTripPointPresenter({
      container: this.#pointsListComponent.element,
      onDataChange: this.#handleViewAction,
      onDestroy: () => this.#handleNewPointFormClose(),
    });
    this.#tripPointsModel.addObserver(this.#handleModelEvent);
    this.#filterModel.addObserver(this.#handleModelEvent);
  }

  createTripPoint() {
    this.#newTripPointButton.disabled = true;
    this.#currentSortType = SortType.DAY;
    this.#filterModel.setFilter(UpdateType.MAJOR, FilterType.EVERYTHING);
    if (this.#tripPointsModel.tripPoints.length === 0) {
      remove(this.#noPointsComponent);
      this.#renderPointsListComponent();
    }
    this.#newTripPointPresenter.init(
      this.#tripPointsModel.destinations,
      this.#tripPointsModel.offers
    );
  }

  get tripPoints() {
    this.#filterType = this.#filterModel.filter;
    const tripPoints = this.#tripPointsModel.tripPoints;
    const filteredTripPoints = filter[this.#filterType](tripPoints);
    switch (this.#currentSortType) {
      case SortType.DAY:
        return filteredTripPoints.sort(sortDate);
      case SortType.TIME:
        return filteredTripPoints.sort(sortTime);
      case SortType.PRICE:
        return filteredTripPoints.sort(sortPrice);
    }
    return filteredTripPoints;
  }

  init() {
    this.#renderPointsBoard();
  }

  #handleNewPointFormClose() {
    this.#newTripPointButton.disabled = false;
    if (this.#tripPointsModel.tripPoints.length === 0) {
      this.init();
    }
  }

  #renderPointsBoard() {
    if (this.#isLoading) {
      this.#renderLoading();
      return;
    }
    const currentFilterPointsAmount = this.tripPoints.length;
    if (currentFilterPointsAmount) {
      this.#renderSortComponent();
      this.#renderTripPoints();
    } else {
      this.#renderNoPointsMessage(this.#filterType.toUpperCase());
    }
  }

  #renderNoPointsMessage() {
    this.#noPointsComponent = new NoPointsView({
      filterType: this.#filterType,
    });
    render(this.#noPointsComponent, this.#container);
  }

  #renderLoading() {
    render(this.#loadingComponent, this.#container);
  }

  #renderTripPoints() {
    this.#renderPointsListComponent();
    const tripPoints = this.tripPoints;
    for (let i = 0; i < tripPoints.length; i++) {
      this.#renderTripPoint(tripPoints[i], this.#pointsListComponent);
    }
  }

  #renderTripPoint(tripPoint, tripPointsContainer) {
    const tripPointPresenter = new TripPointPresenter({
      container: tripPointsContainer,
      onDataChange: this.#handleViewAction,
      onModeChange: this.#handleModeChange,
      availableDestinations: this.#tripPointsModel.destinations,
      availableOffers: this.#tripPointsModel.offers,
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
    this.#newTripPointPresenter.destroy();
    this.#tripPointsPresenters.forEach((presenter) => presenter.destroy());
    this.#tripPointsPresenters.clear();
    remove(this.#sortComponent);
    remove(this.#noPointsComponent);
    if (resetSortType) {
      this.#currentSortType = SortType.DAY;
    }
    remove(this.#loadingComponent);
  }

  #handleModeChange = () => {
    this.#newTripPointPresenter.destroy();
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
      case UpdateType.INIT:
        this.#isLoading = false;
        remove(this.#loadingComponent);
        this.#renderPointsBoard();
        break;
    }
  };

  #handleViewAction = async (actionType, updateType, update) => {
    this.#uiBlocker.block();
    switch (actionType) {
      case UserAction.UPDATE_TRIP_POINT:
        this.#tripPointsPresenters.get(update.id).setSaving();
        try {
          await this.#tripPointsModel.updateTripPoint(updateType, update);
        } catch (err) {
          this.#tripPointsPresenters.get(update.id).setAborting();
        }
        break;
      case UserAction.ADD_TRIP_POINT:
        this.#newTripPointPresenter.setSaving();
        try {
          await this.#tripPointsModel.addTripPoint(updateType, update);
        } catch (err) {
          this.#newTripPointPresenter.setAborting();
        }
        break;
      case UserAction.DELETE_TRIP_POINT:
        this.#tripPointsPresenters.get(update.id).setDeleting();
        try {
          await this.#tripPointsModel.deleteTripPoint(updateType, update);
        } catch (err) {
          this.#tripPointsPresenters.get(update.id).setAborting();
        }
        break;
    }
    this.#uiBlocker.unblock();
  };
}
