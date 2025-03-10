import introJs from 'intro.js';
import PropTypes from 'prop-types';
import { Component, isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.js';

import * as introJsPropTypes from '../../helpers/proptypes';
import * as introJsDefaultProps from '../../helpers/defaultProps';
import { isServer } from '../../helpers/server';

/**
 * Intro.js Steps Component.
 */
export default class Steps extends Component {
  /**
   * React Props
   * @type {Object}
   */
  static propTypes = {
    enabled: PropTypes.bool,
    initialStep: PropTypes.number.isRequired,
    steps: PropTypes.arrayOf(
      PropTypes.shape({
        element: PropTypes.oneOfType([
          PropTypes.string,
          /* istanbul ignore next */
          typeof Element === 'undefined' ? PropTypes.any : PropTypes.instanceOf(Element),
        ]),
        intro: PropTypes.node.isRequired,
        position: introJsPropTypes.tooltipPosition,
        tooltipClass: PropTypes.string,
        highlightClass: PropTypes.string,
      })
    ).isRequired,
    onStart: PropTypes.func,
    onExit: PropTypes.func.isRequired,
    onBeforeExit: PropTypes.func,
    onBeforeChange: PropTypes.func,
    onAfterChange: PropTypes.func,
    onChange: PropTypes.func,
    onPreventChange: PropTypes.func,
    onComplete: PropTypes.func,
    options: introJsPropTypes.options,
  };

  /**
   * React Default Props
   * @type {Object}
   */
  static defaultProps = {
    enabled: false,
    onStart: null,
    onBeforeExit: null,
    onBeforeChange: null,
    onAfterChange: null,
    onChange: null,
    onPreventChange: null,
    onComplete: null,
    options: introJsDefaultProps.options,
  };

  /**
   * Creates a new instance of the component.
   * @class
   * @param {Object} props - The props of the component.
   */
  constructor(props) {
    super(props);

    this.introJs = null;
    this.isConfigured = false;
    // We need to manually keep track of the visibility state to avoid a callback hell.
    this.isVisible = false;

    this.installIntroJs();
  }

  /**
   * Lifecycle: componentDidMount.
   * We use this event to enable Intro.js steps at mount time if enabled right from the start.
   */
  componentDidMount() {
    if (this.props.enabled) {
      this.configureIntroJs();
      this.renderSteps();
    }
  }

  /**
   * Lifecycle: componentDidUpdate.
   * @param  {Object} prevProps - The previous props.
   */
  componentDidUpdate(prevProps) {
    const { enabled, steps, options } = this.props;

    if (!this.isConfigured || prevProps.steps !== steps || prevProps.options !== options) {
      this.configureIntroJs();
      this.renderSteps();
    }

    if (prevProps.enabled !== enabled) {
      this.renderSteps();
    }
  }

  /**
   * Lifecycle: componentWillUnmount.
   * We use this even to hide the steps when the component is unmounted.
   */
  componentWillUnmount() {
    this.introJs.exit();
  }

  /**
   * Triggered when Intro.js steps are exited.
   */
  onExit = () => {
    const { onExit } = this.props;

    this.isVisible = false;

    onExit(this.introJs._currentStep);
  };

  /**
   * Triggered before exiting the intro.
   * @return {Boolean} Returning `false` will prevent exiting the intro.
   */
  onBeforeExit = () => {
    const { onBeforeExit } = this.props;

    if (onBeforeExit) {
      return onBeforeExit(this.introJs._currentStep);
    }

    return true;
  };

  /**
   * Triggered before changing step.
   * @return {Boolean} Returning `false` will prevent the step transition.
   */
  onBeforeChange = nextElement => {
    if (!this.isVisible) {
      return true;
    }

    const { onBeforeChange, onPreventChange } = this.props;

    if (onBeforeChange) {
      const continueStep = onBeforeChange(this.introJs._currentStep, nextElement);

      if (continueStep === false && onPreventChange) {
        setTimeout(() => {
          onPreventChange(this.introJs._currentStep);
        }, 0);
      }

      return continueStep;
    }

    return true;
  };

  /**
   * Triggered after changing step.
   * @param  {HTMLElement} element - The element associated to the new step.
   */
  onAfterChange = element => {
    if (!this.isVisible) {
      return;
    }

    const { onAfterChange } = this.props;

    if (onAfterChange) {
      onAfterChange(this.introJs._currentStep, element);
    }
  };

  /**
   * Triggered when changing step.
   * @param  {HTMLElement} element - The element associated to the next step.
   */
  onChange = element => {
    if (!this.isVisible) {
      return;
    }

    const { onChange } = this.props;

    if (onChange) {
      onChange(this.introJs._currentStep, element);
    }
  };

  /**
   * Triggered when completing all the steps.
   */
  onComplete = () => {
    const { onComplete } = this.props;

    if (onComplete) {
      onComplete();
    }
  };

  /**
   * Updates the element associated to a step based on its index.
   * This is useful when the associated element is not present in the DOM on page load.
   * @param  {number} stepIndex - The index of the step to update.
   */
  updateStepElement = stepIndex => {
    const element = document.querySelector(this.introJs._options.steps[stepIndex].element);

    if (element) {
      this.introJs._introItems[stepIndex].element = element;
      this.introJs._introItems[stepIndex].position = this.introJs._options.steps[stepIndex].position || 'auto';
    }
  };

  /**
   * Installs Intro.js.
   */
  installIntroJs() {
    if (isServer()) {
      return;
    }

    this.introJs = introJs();

    this.introJs.onexit(this.onExit);
    this.introJs.onbeforeexit(this.onBeforeExit);
    this.introJs.onbeforechange(this.onBeforeChange);
    this.introJs.onafterchange(this.onAfterChange);
    this.introJs.onchange(this.onChange);
    this.introJs.oncomplete(this.onComplete);
  }

  /**
   * Configures Intro.js if not already configured.
   */
  configureIntroJs() {
    const { options, steps } = this.props;

    const sanitizedSteps = steps.map(step => {
      if (isValidElement(step.intro)) {
        return {
          ...step,
          intro: renderToStaticMarkup(step.intro),
        };
      }

      return step;
    });

    this.introJs.setOptions({ ...options, steps: sanitizedSteps });

    this.isConfigured = true;
  }

  /**
   * Renders the Intro.js steps.
   */
  renderSteps() {
    const { enabled, initialStep, steps, onStart } = this.props;

    if (enabled && steps.length > 0 && !this.isVisible) {
      this.introJs.start();

      this.isVisible = true;

      this.introJs.goToStepNumber(initialStep + 1);

      if (onStart) {
        onStart(this.introJs._currentStep);
      }
    } else if (!enabled && this.isVisible) {
      this.isVisible = false;

      this.introJs.exit();
    }
  }

  /**
   * Renders the component.
   * @return {null} We do not want to render anything.
   */
  render() {
    return null;
  }
}
