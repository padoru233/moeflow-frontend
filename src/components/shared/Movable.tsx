import { css } from '@emotion/core';
import Bowser from 'bowser';
import { size, has, debounce, throttle } from 'lodash-es';
import React, {
  forwardRef,
  ReactElement,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { FC } from '../../interfaces';
import { useStateRef } from '../../hooks';

/**
 * ========== Context =========
 */
/**传递给被包裹组件的参数 */
export interface MovableInfo {
  area: {
    width: number;
    height: number;
    scale: number;
  };
  item: {
    focus: boolean;
    allowMove: boolean;
    allowZoom: boolean;
    x: number;
    y: number;
    scale: number;
  };
}
const MovableInfoDefault: MovableInfo = {
  area: {
    width: 0,
    height: 0,
    scale: 1,
  },
  item: {
    focus: false,
    allowMove: true,
    allowZoom: false,
    x: 0,
    y: 0,
    scale: 1,
  },
};
export const MovableInfoContext = React.createContext(MovableInfoDefault);
/**
 * ========== 浏览器识别 ===========
 */
const browser = Bowser.getParser(window.navigator.userAgent);
const isSafariForMacOS = browser.satisfies({
  macos: {
    safari: '>9',
  },
});
const isIOS = browser.getOSName() === 'iOS';

/**
 * ========== 可移动区域 ==========
 */
/** 可移动区域的属性接口 */
export interface MovableAreaProps {
  width: number;
  height: number;
  scale?: number;
  focusIndex?: number;
  onFocusIndexChange?: (index: number) => void;
  backgroundElement?: ReactElement;
  otherStyle?: object; // 其他 inline 样式
}
/**
 * 可移动区域
 * @param width 宽度，单位 px（默认值 400）
 * @param height 高度，单位 px（默认值 400）
 * @param scale 组件和父级组件通过 CSS 缩放的总比例，以此来计算真实尺寸，使子组件移动正确（默认值 1）
 * @param focusIndex 默认可移动元素焦点，通过设置此值达到切换焦点的目的
 * @param onFocusIndexChange 当点击后焦点 index 变化后触发
 * @param backgroundElement 放置在最下层不可移动的背景元素
 * @param otherStyle 其他 style（默认值 {}）
 * @param otherProps 其他 props，会直接传递给 dom（如 data-testid）
 * */
export const MovableArea: FC<MovableAreaProps> = ({
  width,
  height,
  scale,
  focusIndex = -1,
  onFocusIndexChange,
  otherStyle = {},
  backgroundElement,
  children,
  ...otherProps
}) => {
  const movableInfo = useContext(MovableInfoContext);
  if (!scale) {
    scale = movableInfo.item.scale;
  }

  const domRef = useRef<HTMLDivElement>(null); // 节点自身 Ref

  const lastTouchEndRef = useRef(0); // 最后触摸时间
  useEffect(() => {
    // 阻止默认动作
    function preventDefault(e: Event) {
      e.preventDefault();
    }
    // 阻止小于 300ms 的 touchend，防止 iOS 上浏览器双击缩放页面
    function preventDoubleTapZoom(e: TouchEvent) {
      const now = Date.now();
      if (now - lastTouchEndRef.current <= 300) {
        // 阻止动作
        e.preventDefault();
        // 触发一个 click 来代替本次 touchend（不会触发双击缩放页面）
        const evt = document.createEvent('Event');
        evt.initEvent('click', true, false);
        if (e.target) {
          e.target.dispatchEvent(evt);
        }
      }
      lastTouchEndRef.current = now;
    }
    const dom = domRef.current;
    // P.S. 必须使用 passive: false，主动告诉浏览器我们需要阻止默认动作，否则不会生效
    //【桌面浏览器 (除 Safari for macOS)】阻止触摸板右滑返回，左滑前进，两指双击页面缩放（表现为 wheel 事件），双指页面缩放（表现为 wheel 事件）
    dom?.addEventListener('wheel', preventDefault, {
      passive: false,
    });
    //【桌面浏览器 (Safari for macOS)】阻止触摸板双指页面缩放（表现为 gesture 事件）
    dom?.addEventListener('gesturestart', preventDefault, {
      passive: false,
    });
    dom?.addEventListener('gesturechange', preventDefault, {
      passive: false,
    });
    dom?.addEventListener('gestureend', preventDefault, {
      passive: false,
    });
    // 【iOS 上浏览器】阻止双击页面缩放
    if (isIOS) {
      dom?.addEventListener('touchend', preventDoubleTapZoom, {
        passive: false,
      });
    }
    return () => {
      dom?.removeEventListener('wheel', preventDefault);
      dom?.removeEventListener('gesturestart', preventDefault);
      dom?.removeEventListener('gesturechange', preventDefault);
      dom?.removeEventListener('gestureend', preventDefault);
      if (isIOS) {
        dom?.removeEventListener('touchend', preventDoubleTapZoom);
      }
    };
  }, []);

  // 将可移动区域的状态传递给可移动元素
  const childrenWithProps = useMemo(() => {
    return React.Children.map(children, (child, index) => {
      if (React.isValidElement(child)) {
        return React.cloneElement(child, {
          areaWidth: width,
          areaHeight: height,
          areaScale: scale,
          itemIndex: index,
          onFocusIndexChange: onFocusIndexChange,
          focus: index === focusIndex,
        });
      } else {
        return child;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, scale, focusIndex, children]);

  return (
    <div
      css={css`
        position: relative;
        /* 用于阻止浏览器触摸动作的默认的移动、双指缩放页面等手势 */
        touch-action: none;
      `}
      style={{
        width: width + 'px',
        height: height + 'px',
        ...otherStyle,
      }}
      ref={domRef}
      {...otherProps}
    >
      {backgroundElement}
      {childrenWithProps}
    </div>
  );
};
MovableArea.whyDidYouRender = true;
/**
 * ========== 可移动元素 ==========
 */
/**可移动元素的基本状态 */
export interface Size {
  width: number;
  height: number;
}
export interface Position {
  x: number;
  y: number;
}
export interface MovableItemState {
  x: number;
  y: number;
  scale: number;
}
/**移动控制函数接口 */
export interface Move {
  (position: Position | ((prevState: MovableItemState) => Position)): void;
}
export interface ZoomOptions {
  silent?: boolean;
}
/**缩放控制函数接口 */
export interface Zoom {
  (
    state:
      | {
          scale: number;
          centerX?: number;
          centerY?: number;
          moveX?: number;
          moveY?: number;
        }
      | ((prevState: MovableItemState) => {
          scale: number;
          centerX?: number;
          centerY?: number;
          moveX?: number;
          moveY?: number;
        }),
    options?: ZoomOptions,
  ): void;
}
/**用于更新自身尺寸的函数 */
interface UpdateSize {
  ({ size }: { size?: Size }): void;
}
interface UpdateSize {
  (): void;
}
export interface MovableItemMarginsX {
  edge: 'left' | 'right' | 'center';
  px: number;
}
export interface MovableItemMarginsY {
  edge: 'top' | 'bottom' | 'center';
  px: number;
}
/**获取距离最近边的 px 距离 */
export interface MovableItemMargins {
  x: MovableItemMarginsX;
  y: MovableItemMarginsY;
}
interface GetClosestMarginsParams {
  xCenter?: boolean;
  yCenter?: boolean;
  xCenterTolerance?: number;
  yCenterTolerance?: number;
}
interface GetClosestMargins {
  (params?: GetClosestMarginsParams): MovableItemMargins;
}
interface GetScaleStepScale {
  (scale: number): number;
}
/**转换相对某一条边的 px 为相对与左上角的百分比 */
interface MoveWithMargins {
  (margins: MovableItemMargins): Position;
}
/**可移动元素的 ref 参数*/
export interface MovableItemRef {
  zoom: Zoom;
  move: Move;
  getSize: () => Size;
  updateSize: UpdateSize;
  getState: () => MovableItemState;
  moveWithMargins: MoveWithMargins;
  getClosestMargins: GetClosestMargins;
  getScaleStepScale: GetScaleStepScale;
}
/**可移动元素的 ref*/
export type MovableItemUseRef = React.MutableRefObject<MovableItemRef>;

/**可移动元素事件监听器 */
export interface OnTap {
  (params: Position & { button: number }): void;
}
export interface OnLongPress {
  (params: Position & { button: number }): void;
}
export interface OnMoveStart {
  (params: MovableItemState): void;
}
export interface OnMoving {
  (params: MovableItemState): void;
}
export interface OnMoveEnd {
  (
    params: MovableItemState & {
      reset: () => void;
    },
  ): void;
}
export interface OnZoomStart {
  (params: MovableItemState): void;
}
export interface OnZooming {
  (params: MovableItemState): void;
}
export interface OnZoomEnd {
  (params: MovableItemState): void;
}
/** 可移动元素的属性接口 */
export interface MovableItemProps {
  onFocusIndexChange?(index: number): void;
  itemIndex?: number;
  focus?: boolean;
  allowMove?: boolean;
  layer?: 'auto' | 'front' | 'end';
  minScale?: number;
  maxScale?: number;
  scaleStep?: number;
  defaultScale?: number;
  defaultPosition?: { x: number; y: number };
  onTap?: OnTap;
  onLongPress?: OnLongPress;
  longPressDelay?: number;
  onMoveStart?: OnMoveStart;
  onMoving?: OnMoving;
  onMoveEnd?: OnMoveEnd;
  onZoomStart?: OnZoomStart;
  onZooming?: OnZooming;
  onZoomEnd?: OnZoomEnd;
  areaWidth?: number;
  areaHeight?: number;
  areaScale?: number;
  allowZoom?: boolean;
  limitInArea?: boolean; // 限制左上角坐标在可移动区域内
  limitWithSize?: boolean; // 限制左上角坐标在移动区域内时，同时自身也不能超出可移动区域
  limitWithSizeOnAreaResize?: boolean; // 可移动区域大小变化时，限制自身不能超出可移动区域
  transition?: string;
  otherStyle?: object; // 其他 inline 样式
  updateSizeOnMounted?: boolean;
}
/**
 * 可移动元素
 *
 * 会向其中增加move和zoom方法，用于在上级元素控制本元素移动缩放
 * @param layer 元素层级（默认值 'auto'）
 * - front 永远在最前
 * - auto 根据dom的顺序自动排列，点击后在最前
 * - back 永远在最后
 * @param allowMove 可否移动（默认值 true）
 * @param defaultPosition 位置初始值（百分比）（默认值 {x: 0, y: 0}）
 * @param limitInArea 将元素左上角移动范围限制在可移动区域中（默认值 true）
 * @param limitWithSize 包含自身大小也不能移动出可移动区域（默认值 true）
 * @param limitWithSizeOnAreaResize 当可移动区域大小变化时，检测自身大小是否超出区域，并作出限制（默认值 true）
 * @param allowZoom 可否缩放（默认值 false）
 * @param defaultScale 缩放倍数初始值（默认值 1）
 * @param minScale 最小缩放倍数（默认值 0.1）
 * @param maxScale 最大缩放倍数（默认值 5）
 * @param scaleStep 缩放倍数步长（默认值 0.1）
 * @param transition CSS 的 transition 属性
 * @param otherStyle 其他 style（默认值 {}），比如被包裹的元素进行了缩放，需要运行穿透点击下面的元素，可以设置{ pointerEvents: 'none' }
 * @param onTap 监听点击
 * @param onLongPress 监听长按
 * @param longPressDelay 长按触发的时间（默认值 500）
 * @param onMoveStart 监听移动开始
 * @param onMoving 监听移动中
 * @param onMoveEnd 监听移动结束
 * @param onZoomStart 监听缩放结束
 * @param onZooming 监听缩放中
 * @param onZoomEnd 监听缩放结束
 * @param ref ref 提供 move zoom 函数用于控制组件移动/缩放
 * @param otherProps 其他 props，会直接传递给 dom（如 data-testid）
 * @param updateSizeOnMounted 是否在挂载时自动获取元素大小
 * @param onFocusIndexChange 【请勿设置】父级 MovableArea 传入的属性，设置可移动区域内最后点击的元素
 * @param itemIndex 【请勿设置】父级 MovableArea 传入的属性，可移动区域内使用的id
 * @param focus 【请勿设置】父级 MovableArea 传入的属性，可移动区域内最后点击的焦点元素
 * @param area 【请勿设置】父级 MovableArea 传入的属性，可移动区域的属性
 *
 * ## FAQ
 *
 * ### 如何在父组件移动/缩放元素？
 *
 * 使用元素的 ref 属性，提供 move zoom 两个方法，实例代码如下
 *
 * ```typescript
 * import { MovableArea, MovableItem, MovableItemUseRef} from 'Movable';
 *
 * const MovableBox: FC = () => {
 *   const itemRef = useRef() as MovableItemUseRef
 *
 *   useEffect(()=>{
 *     itemRef.current.move({ x: 0.5, y: 0.5 });
 *     itemRef.current.zoom(({ scale, x, y }) => ({ scale: scale * 2 }));
 *   })
 *
 *   return (
 *     <MovableArea width={100} height={100}>
 *       <MovableItem ref={itemRef}>
 *     </MovableArea>
 *   )
 * }
 * ```
 *
 * ### 如何在被包裹组件中监听移动/缩放事件？
 *
 * 对象中可包含如下属性名的事件回调：
 *
 * - onMoveStart：元素开始移动
 * - onMoving：元素移动中
 * - onMoveEnd：元素停止移动
 * - onZooming：元素缩放
 *
 */
const MovableItemWithoutRef: React.ForwardRefRenderFunction<
  MovableItemRef,
  React.PropsWithChildren<MovableItemProps>
> = (
  {
    layer = 'auto',
    allowMove = true,
    defaultPosition = { x: 0, y: 0 },
    limitInArea = true,
    limitWithSize = true,
    limitWithSizeOnAreaResize = true,
    allowZoom = false,
    defaultScale = 1,
    minScale = 0.1,
    maxScale = 5,
    scaleStep = 0.1,
    otherStyle = {},
    onTap,
    onLongPress,
    longPressDelay = 500,
    onMoveStart,
    onMoving,
    onMoveEnd,
    onZoomStart,
    onZooming,
    onZoomEnd,
    onFocusIndexChange,
    itemIndex,
    focus = false,
    areaWidth = 0,
    areaHeight = 0,
    areaScale = 1,
    transition = '',
    updateSizeOnMounted = true,
    children,
    ...otherProps
  },
  ref,
) => {
  // 当前的位置/缩放状态 {x, y, scale}
  const defaultState: MovableItemState = {
    scale: defaultScale,
    ...defaultPosition,
  };
  // 此 ref 用于光标移动事件中，及时获取最新的 state，因为事件监听是在光标按下时注册于 window 上的，所以其中 state 不会发生变化
  // 此 ref 用于光标移动结束，完成赋值 state 之前，提前设置 stateRef，这样在回调中就能调用其他使用了 stateRef 的函数
  const [state, setState, stateRef] = useStateRef(defaultState);
  // 用于记录多个点击点的位置
  const pointersRef: {
    current: { [propsName: number]: { clientX: number; clientY: number } };
  } = useRef({});
  const movingRef = useRef(false); // 是否正在移动
  const zoomingRef = useRef(false); // 是否正在缩放
  const lastZoomEndTimeoutRef = useRef(-1); // 记录 滚轮/ref.zoom() 设置的 zoomend 定时器，用于防抖
  const sizeRef = useRef({ width: 0, height: 0 }); // 组件未缩放的大小
  const domRef = useRef<HTMLDivElement>(null); // 节点自身 Ref
  const longPressTimeoutRef = useRef(-1);
  const longPressTriggeredRef = useRef(false);
  const allowMoveRef = useRef(allowMove);
  const _mountedRef = useRef(true);

  useEffect(() => {
    allowMoveRef.current = allowMove;
  }, [allowMove]);

  useEffect(() => {
    return () => {
      _mountedRef.current = false;
    };
  }, []);

  // 将控制函数注册到父组件的 ref
  useImperativeHandle(ref, () => {
    const imperatives: MovableItemRef = {
      zoom: zoomViaRef,
      move: moveViaRef,
      getSize,
      updateSize,
      getState,
      moveWithMargins,
      getClosestMargins,
      getScaleStepScale,
    };
    return imperatives;
  });

  // 更新元素大小
  const updateSize: UpdateSize = ({ size }: { size?: Size } = {}) => {
    // 如果没有给予 size，则获取自身节点大小
    if (size === undefined) {
      size = {
        width: (domRef.current as HTMLElement).offsetWidth,
        height: (domRef.current as HTMLElement).offsetHeight,
      };
    }
    sizeRef.current = size;
  };

  // 元素第一次布局时，更新元素大小
  // 注意：元素内如果有图片等延时加载的部分，会导致不能正确设置大小
  // 需要设置 updateSizeOnMounted=false，并自行调用 updateSize 设置
  useEffect(() => {
    if (updateSizeOnMounted) {
      updateSize();
    }
    // eslint-disable-next-line
  }, []);

  // 获取元素未缩放大小
  function getSize(): Size {
    return sizeRef.current;
  }

  // 获取元素移动/缩放状态
  function getState(): MovableItemState {
    return stateRef.current;
  }

  // 获取缩放倍数小于 1 时，缩放步长的倍数（如 1倍-1/2倍 则是 0.5）
  const getScaleStepScale: GetScaleStepScale = (scale) => {
    if (scale >= 1) {
      return 1;
    } else {
      return 1 / (Math.floor(1 / scale) + 1);
    }
  };

  /**
   * 【缩放】处理 Chrome/Firefox 上滚轮缩放（Safari 上为 gesture 事件）
   */
  function handleWheel(e: React.WheelEvent): void {
    if (!allowZoom) {
      return;
    }
    zoomingRef.current = true;
    // 调用开始缩放回调
    if (onZoomStart) {
      onZoomStart(state);
    }
    // 取消之前结束缩放 timeout
    if (lastZoomEndTimeoutRef.current > -1) {
      clearTimeout(lastZoomEndTimeoutRef.current);
      lastZoomEndTimeoutRef.current = -1;
    }
    // 记录滚动时组件初始 state
    startStateRef.current = stateRef.current;
    // 光标相对本组件的位置百分比
    const pointerX =
      (e.clientX - areaWidth * stateRef.current.x) /
      (getSize().width * stateRef.current.scale);
    const pointerY =
      (e.clientY - areaHeight * stateRef.current.y) /
      (getSize().height * stateRef.current.scale);
    // 缩小
    if (e.deltaY > 0) {
      throttledZoom((prevState) => {
        return {
          scale:
            prevState.scale - scaleStep * getScaleStepScale(prevState.scale),
          centerX: pointerX,
          centerY: pointerY,
        };
      });
    }
    // 放大
    if (e.deltaY < 0) {
      throttledZoom((prevState) => {
        return {
          scale:
            prevState.scale + scaleStep * getScaleStepScale(prevState.scale),
          centerX: pointerX,
          centerY: pointerY,
        };
      });
    }
    // 延迟停止缩放
    lastZoomEndTimeoutRef.current = window.setTimeout(() => {
      zoomingRef.current = false;
      // 调用结束缩放回调
      if (onZoomEnd) {
        onZoomEnd(state);
      }
    }, 150);
  }

  /**
   * 【缩放】处理桌面版 Safari 触摸板双指缩放，以及 iOS 上的浏览器的触屏双指缩放手势
   */
  function handleGestureStart(e: any): void {
    if (!allowZoom) {
      return;
    }
    zoomingRef.current = true;
    // 调用开始缩放回调
    if (onZoomStart) {
      onZoomStart(state);
    }
    // 记录按下时组件初始 state
    startStateRef.current = stateRef.current;
  }

  const handleGestureChange = (e: any): void => {
    if (!allowZoom) {
      return;
    }
    // 不在缩放时，忽略触发
    if (!zoomingRef.current) {
      return;
    }
    // 光标相对本组件的位置百分比
    const centerX =
      (e.clientX - areaWidth * startStateRef.current.x) /
      (getSize().width * startStateRef.current.scale);
    const centerY =
      (e.clientY - areaHeight * startStateRef.current.y) /
      (getSize().height * startStateRef.current.scale);
    // 根据 scale 的变化缩放
    throttledZoom({
      scale: startStateRef.current.scale * e.scale,
      centerX,
      centerY,
    });
  };

  const handleGestureEnd = (e: any): void => {
    if (!allowZoom) {
      return;
    }
    zoomingRef.current = false;
    // 调用结束缩放回调
    if (onZoomEnd) {
      onZoomEnd(state);
    }
  };

  // 接管 Safari for macOS 浏览器中双指手势的默认动作（放大/缩小页面等）
  useEffect(() => {
    // 仅为 Safari for macOS 的触摸板双指手势注册 gesture 事件（iOS 上浏览器通过 pointer 事件控制）
    if (isSafariForMacOS) {
      const dom = domRef.current as HTMLElement;
      // 接管本 Item 上的双指缩放手势（必须加上 passive）
      dom.addEventListener('gesturestart', handleGestureStart, {
        passive: false,
      });
      dom.addEventListener('gesturechange', handleGestureChange, {
        passive: false,
      });
      dom.addEventListener('gestureend', handleGestureEnd, {
        passive: false,
      });
      return () => {
        dom.removeEventListener('gesturestart', handleGestureStart);
        dom.removeEventListener('gesturechange', handleGestureChange);
        dom.removeEventListener('gestureend', handleGestureEnd);
      };
    }
  });

  /**
   * 将相对与某条边的 px 值，转换为相对与左上角的位置百分比
   * @param edge 上下左右哪条边
   * @param px 距离边缘的 px 值（如果 edge=center， 则 px 为居中后距离元素左上角偏移的值）
   * @param size 组件的大小
   */
  const moveWithMargins: MoveWithMargins = (margins) => {
    const position: Position = { x: 0, y: 0 };
    // 计算 x 轴上百分比
    if (margins.x.edge === 'left') {
      // 根据左边定位
      position.x = margins.x.px / areaWidth;
    } else if (margins.x.edge === 'right') {
      // 根据右边定位
      position.x =
        (areaWidth - sizeRef.current.width - margins.x.px) / areaWidth;
    } else {
      // 水平居中
      position.x = 0.5 - (sizeRef.current.width / 2 - margins.x.px) / areaWidth;
    }
    // 计算 y 轴上百分比
    if (margins.y.edge === 'top') {
      // 根据上边定位
      position.y = margins.y.px / areaHeight;
    } else if (margins.y.edge === 'bottom') {
      // 根据底边定位
      position.y =
        (areaHeight - sizeRef.current.height - margins.y.px) / areaHeight;
    } else {
      // 垂直居中
      position.y =
        0.5 - (sizeRef.current.height / 2 - margins.y.px) / areaHeight;
    }
    return position;
  };

  /**
   * 将相对与某条边的 px 值，转换为相对与左上角的位置百分比
   * @param xCenter x 轴方向是否返回 center 类型（默认 false）
   * @param yCenter y 轴方向是否返回 center 类型（默认 false）
   * @param xCenterTolerance 认定元素居中时，x 轴方向两边距离差值允许的误差 px（默认 0）
   * @param yCenterTolerance 认定元素居中时，y 轴方向两边距离差值允许的误差 px（默认 0）
   */
  const getClosestMargins: GetClosestMargins = ({
    xCenter = false,
    yCenter = false,
    xCenterTolerance = 0,
    yCenterTolerance = 0,
  }: GetClosestMarginsParams = {}) => {
    const left = stateRef.current.x * areaWidth;
    const right = areaWidth - left - getSize().width;
    const top = stateRef.current.y * areaHeight;
    const bottom = areaHeight - top - getSize().height;
    // 计算 x 轴上最近边
    const x: MovableItemMarginsX = { edge: 'left', px: left };
    if (xCenter && Math.abs(left - right) <= xCenterTolerance) {
      x.edge = 'center';
      x.px = (left - right) / 2;
    } else {
      if (Math.abs(left) > Math.abs(right)) {
        x.edge = 'right';
        x.px = right;
      }
    }
    // 计算 y 轴上最近边
    const y: MovableItemMarginsY = { edge: 'top', px: top };
    if (yCenter && Math.abs(top - bottom) <= yCenterTolerance) {
      y.edge = 'center';
      y.px = (top - bottom) / 2;
    } else {
      if (Math.abs(top) > Math.abs(bottom)) {
        y.edge = 'bottom';
        y.px = bottom;
      }
    }
    return { x, y };
  };

  /**
   * 控制移动
   * @param position 缩放参数对象 或 返回此对象的函数
   * @param position.x 移动位置 X
   * @param position.y 移动位置 Y
   */
  const move: Move = (position) => {
    setState((prevState) => {
      // 如果是一个函数，则给予当前 position， 运行函数获取新scale
      if (typeof position === 'function') {
        position = position(prevState);
      }
      const { x, y } = position;
      // 当位置变化完成时，调用回调
      if (onMoving) {
        onMoving({ ...prevState, x, y });
      }
      return { ...prevState, x, y };
    });
  };

  // 不在移动中则跳过，防止延时执行的 debouncedMove 覆盖光标抬起时位置
  // 元素被删除则跳过，防止延时执行的 debouncedMove updates on unmounted React components
  const moveWhenMoving: Move = (...args) => {
    if (!movingRef.current || !_mountedRef.current) {
      return;
    }
    move(...args);
  };
  const debouncedMove = debounce(moveWhenMoving, 1);

  // 通过 ref 调用的 zoom，进行限位
  const moveViaRef: Move = (position) => {
    move((prevState) => {
      // 如果是一个函数，则给予当前 position， 运行函数获取新scale
      if (typeof position === 'function') {
        position = position(prevState);
      }
      let newState = { ...prevState, ...position };
      if (limitInArea) {
        newState = limitPosition(newState);
      }
      return { x: newState.x, y: newState.y };
    });
  };

  /**
   * 控制缩放
   * @param state 缩放参数对象 或 返回此对象的函数
   * @param state.scale 缩放比例
   * @param state.centerX 缩放中心 X
   * @param state.centerY 缩放中心 Y
   * @param options 其他配置
   * @param options.silent 不触发 onZooming 回调（默认 false）
   */
  const zoom: Zoom = (state, { silent = false }: ZoomOptions = {}) => {
    setState((prevState: MovableItemState) => {
      // 如果是一个函数，则给予当前 state，运行函数获取新scale
      if (typeof state === 'function') {
        state = state(prevState);
      }
      let { scale, centerX = 0.5, centerY = 0.5, moveX = 0, moveY = 0 } = state;
      // 限制缩放中心位置在 item 上的（即不能超过100%，不能小于0%）
      if (centerX > 1) centerX = 1;
      if (centerX < 0) centerX = 0;
      if (centerY > 1) centerY = 1;
      if (centerY < 0) centerY = 0;
      // 限制缩放值
      if (scale > maxScale) scale = maxScale;
      if (scale < minScale) scale = minScale;
      // 提供了新的 x，y 位置，则按此计算
      // 将要缩放的百分比
      const scaleDelta = scale - startStateRef.current.scale;
      // 根据（ 将要缩放的 item 大小 / area 的大小 ）* 缩放中心位置，算出要在 area 中偏移的百分比
      const offsetX = ((scaleDelta * getSize().width) / areaWidth) * centerX;
      const offsetY = ((scaleDelta * getSize().height) / areaHeight) * centerY;
      // 计算新位置
      const x = startStateRef.current.x + moveX - offsetX;
      const y = startStateRef.current.y + moveY - offsetY;
      // 当缩放比例变化完成时，调用回调
      if (!silent && onZooming) {
        onZooming({ scale, x, y });
      }
      return { scale, x, y };
    });
  };

  // 不在缩放中则跳过，防止延时执行的 throttledZoom 覆盖缩放结束时的比例
  const zoomWhenZooming: Zoom = (...args) => {
    if (!zoomingRef.current) {
      return;
    }
    zoom(...args);
  };
  const throttledZoom = throttle(zoomWhenZooming, 16, { leading: false });

  // 通过 ref 调用的 zoom
  const zoomViaRef: Zoom = (...args) => {
    if (!allowZoom) {
      return;
    }
    // 记录滚动时组件初始 state
    startStateRef.current = stateRef.current;
    zoomingRef.current = true;
    // 调用开始缩放回调
    if (onZoomStart) {
      onZoomStart(state);
    }
    // 取消之前结束缩放 timeout
    if (lastZoomEndTimeoutRef.current > -1) {
      clearTimeout(lastZoomEndTimeoutRef.current);
      lastZoomEndTimeoutRef.current = -1;
    }
    zoom(...args);
    // 延迟停止缩放
    lastZoomEndTimeoutRef.current = window.setTimeout(() => {
      zoomingRef.current = false;
      // 调用结束缩放回调
      if (onZoomEnd) {
        onZoomEnd(state);
      }
    }, 150);
  };

  // 开始移动/缩放时组件的初始缩放状态，用于通过此计算之后的位置/大小
  const startStateRef = useRef({ x: 0, y: 0, scale: 1 });
  // 开始移动时的时间
  const startMoveTimeRef = useRef(0);
  // 开始移动时的信息
  const startMoveInfoRef = useRef({
    clientX: 0, // 光标的 clientX
    clientY: 0,
  });
  // 开始缩放时的信息
  const startZoomInfoRef = useRef({
    distance: 0, // 开始时双指的距离
    centerClientX: 0, // 双指中心的 clientX
    centerClientY: 0,
  });

  /**
   * 计算双指缩放，光标间信息
   */
  function getTwoPointersInfo(): {
    distance: number;
    distanceX: number;
    distanceY: number;
    centerClientX: number;
    centerClientY: number;
  } {
    // 将光标位置放入数组
    const pointers = [];
    for (const key in pointersRef.current) {
      pointers.push(pointersRef.current[key]);
    }
    // 计算两个光标距离
    const distanceX = Math.abs(pointers[0].clientX - pointers[1].clientX);
    const distanceY = Math.abs(pointers[0].clientY - pointers[1].clientY);
    const distance = Math.sqrt(Math.pow(distanceX, 2) + Math.pow(distanceY, 2));
    return {
      distance,
      distanceX,
      distanceY,
      centerClientX: (pointers[0].clientX + pointers[1].clientX) / 2,
      centerClientY: (pointers[0].clientY + pointers[1].clientY) / 2,
    };
  }

  /**
   * ================ 🔥通用事件处理 ================
   */

  /**
   * 处理按下
   */
  function handleDown({
    pointerId,
    clientX,
    clientY,
    button,
  }: {
    pointerId: number;
    clientX: number;
    clientY: number;
    button: number;
  }): void {
    // 更新光标信息
    pointersRef.current[pointerId] = {
      clientX,
      clientY,
    };
    // 记录按下时组件初始 state
    startStateRef.current = stateRef.current;
    if (size(pointersRef.current) === 1) {
      longPressTriggeredRef.current = false;
      // 1个光标按下，开启移动
      movingRef.current = button === 0;
      zoomingRef.current = false;
      // 记录开始时移动时的时间
      startMoveTimeRef.current = Date.now();
      // 记录开始时移动时的信息
      startMoveInfoRef.current = {
        clientX,
        clientY,
      };
      // 设置当前激活的子组件
      onFocusIndexChange && onFocusIndexChange(itemIndex!);
      // 执行移动开始回调
      if (allowMoveRef.current && onMoveStart && button === 0) {
        onMoveStart(state);
      }
      // 开始监听长按
      if (onLongPress) {
        longPressTimeoutRef.current = window.setTimeout(() => {
          if (pointersRef.current[pointerId]) {
            // 计算光标移动距离
            const distanceX =
              pointersRef.current[pointerId].clientX -
              startMoveInfoRef.current.clientX;
            const distanceY =
              pointersRef.current[pointerId].clientY -
              startMoveInfoRef.current.clientY;
            const distance = Math.sqrt(
              Math.pow(distanceX, 2) + Math.pow(distanceY, 2),
            );
            // 长按位置
            let longPressX =
              (startMoveInfoRef.current.clientX -
                startStateRef.current.x * (areaWidth * areaScale)) /
              (sizeRef.current.width * startStateRef.current.scale);
            let longPressY =
              (startMoveInfoRef.current.clientY -
                startStateRef.current.y * (areaHeight * areaScale)) /
              (sizeRef.current.height * startStateRef.current.scale);
            // 限制点击范围（触摸屏的点击位置可能在元素外，造成大于 1 或者小于 0 的坐标）
            if (longPressX > 1) longPressX = 1;
            if (longPressY > 1) longPressY = 1;
            if (longPressX < 0) longPressX = 0;
            if (longPressY < 0) longPressY = 0;
            if (distance < 5) {
              longPressTriggeredRef.current = true;
              movingRef.current = false;
              onLongPress({
                x: longPressX,
                y: longPressY,
                button: button,
              });
            }
          }
        }, longPressDelay);
      }
    } else if (size(pointersRef.current) === 2) {
      // 2个光标按下，开启移动和缩放
      movingRef.current = true;
      zoomingRef.current = true;
      // 删除开始时移动时的时间
      startMoveTimeRef.current = 0;
      // 记录开始时缩放时的信息
      startZoomInfoRef.current = getTwoPointersInfo();
      // 调用开始缩放回调
      if (allowZoom && onZoomStart) {
        onZoomStart(state);
      }
    } else {
      // 2个以上光标按下，禁止移动/缩放
      movingRef.current = false;
      zoomingRef.current = false;
      if (allowZoom && onZoomEnd) {
        onZoomEnd(state);
      }
    }
  }

  /**
   * 处理移动
   */
  function handleMove({
    pointerId,
    clientX,
    clientY,
  }: {
    pointerId: number;
    clientX: number;
    clientY: number;
  }): void {
    // item 可能在长按的时候就被删除了，这时候就不应响应移动操作
    if (!_mountedRef.current) {
      return;
    }
    // 不是本 item 的移动事件
    if (!has(pointersRef.current, pointerId)) {
      return;
    }
    // 更新光标信息
    pointersRef.current[pointerId] = {
      clientX,
      clientY,
    };
    if (allowMoveRef.current && size(pointersRef.current) === 1) {
      // 1个光标移动，移动
      // 计算光标移动距离
      const distanceX = clientX - startMoveInfoRef.current.clientX;
      const distanceY = clientY - startMoveInfoRef.current.clientY;
      // 计算新位置
      const newPosition = {
        x: startStateRef.current.x + distanceX / (areaWidth * areaScale),
        y: startStateRef.current.y + distanceY / (areaHeight * areaScale),
      };
      debouncedMove({ ...newPosition });
    } else if (allowZoom && size(pointersRef.current) === 2) {
      // 2个光标移动，缩放
      // 计算开始时双指距离 和 X、Y 轴上分别的距离用来计算 tan(x)
      const { distance, distanceX, distanceY, centerClientX, centerClientY } =
        getTwoPointersInfo();
      // 移动了的距离
      const distanceDelta = distance - startZoomInfoRef.current.distance;
      // 缩放倍数
      let hypotenuse: number, zoomedHypotenuse: number;
      // 计算斜边长
      if (distanceX === 0) {
        // 两个手指连线是垂直 90 度，直接使用高度作为斜边长
        hypotenuse = getSize().height;
        zoomedHypotenuse = getSize().height * startStateRef.current.scale;
      } else {
        const imageTan = getSize().height / getSize().width; // 图片对角线的 tan(x)
        const distanceTan = distanceY / distanceX; // 两个手指连线的 tan(x)
        if (distanceTan > imageTan) {
          // 两个手指连线的角度比图片对角线的大，三角形高度等于矩形高度，用 高度/tan(x) 计算
          // 未缩放的斜边
          const partWidth = getSize().height / distanceTan; // 直角三角形在矩形底边的宽度
          hypotenuse = Math.sqrt(
            Math.pow(partWidth, 2) + Math.pow(getSize().height, 2),
          );
          // 缩放后的斜边
          const zoomedPartWidth =
            (getSize().height * startStateRef.current.scale) / distanceTan; // 直角三角形在矩形底边的宽度
          zoomedHypotenuse = Math.sqrt(
            Math.pow(zoomedPartWidth, 2) +
              Math.pow(getSize().height * startStateRef.current.scale, 2),
          );
        } else {
          // 两个手指连线的角度比图片对角线的小，三角形宽度等于矩形宽度，用 宽度*tan(x) 计算
          // 未缩放的斜边
          const partHeight = getSize().width * distanceTan; // 直角三角形在矩形底边的高度
          hypotenuse = Math.sqrt(
            Math.pow(partHeight, 2) + Math.pow(getSize().width, 2),
          );
          // 缩放后的斜边
          const zoomedPartHeight =
            getSize().width * startStateRef.current.scale * distanceTan; // 直角三角形在矩形底边的高度
          zoomedHypotenuse = Math.sqrt(
            Math.pow(zoomedPartHeight, 2) +
              Math.pow(getSize().width * startStateRef.current.scale, 2),
          );
        }
      }
      // 计算缩放比例 (缩放后的斜边+移动距离/(开始时双指距离/缩放后的斜边))/斜边长
      const scale =
        (zoomedHypotenuse +
          distanceDelta /
            (startZoomInfoRef.current.distance / zoomedHypotenuse)) /
        hypotenuse;
      // 计算双指中心移动距离
      const centerDistanceX =
        centerClientX - startZoomInfoRef.current.centerClientX;
      const centerDistanceY =
        centerClientY - startZoomInfoRef.current.centerClientY;
      // 缩放后还要移动的距离（百分比）
      const moveX = centerDistanceX / (areaWidth * areaScale);
      const moveY = centerDistanceY / (areaHeight * areaScale);
      // 计算光标相对本组件的位置百分比（即缩放中心）
      const centerX =
        (startZoomInfoRef.current.centerClientX -
          areaWidth * startStateRef.current.x) /
        (getSize().width * startStateRef.current.scale);
      const centerY =
        (startZoomInfoRef.current.centerClientY -
          areaHeight * startStateRef.current.y) /
        (getSize().height * startStateRef.current.scale);
      throttledZoom({
        scale,
        centerX,
        centerY,
        moveX,
        moveY,
      });
    }
  }

  /**
   * 处理光标抬起
   */
  function handleUp({
    pointerId,
    clientX,
    clientY,
    button,
  }: {
    pointerId: number;
    clientX: number;
    clientY: number;
    button: number;
  }): void {
    // item 可能在长按的时候就被删除了，这时候就不应响应抬起操作
    if (!_mountedRef.current) {
      return;
    }
    // 忽略不是本 item 的抬起事件
    if (!has(pointersRef.current, pointerId)) {
      return;
    }
    if (longPressTimeoutRef.current > -1) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = -1;
    }
    // 删除光标
    delete pointersRef.current[pointerId];
    if (size(pointersRef.current) === 0) {
      // 记录按下/抬起间隔
      const tapDelay = Date.now() - startMoveTimeRef.current;
      // 计算光标移动距离
      const distanceX = clientX - startMoveInfoRef.current.clientX;
      const distanceY = clientY - startMoveInfoRef.current.clientY;
      const distance = Math.sqrt(
        Math.pow(distanceX, 2) + Math.pow(distanceY, 2),
      );
      // 抬起后就没了，移动结束
      movingRef.current = false;
      if (
        !longPressTriggeredRef.current &&
        allowMoveRef.current &&
        limitInArea &&
        button === 0
      ) {
        // 限制移动范围，将超出的部分移动到合适位置
        setState((prevState) => {
          // 组件新位置
          const newState = limitPosition({
            x: startStateRef.current.x + distanceX / (areaWidth * areaScale),
            y: startStateRef.current.y + distanceY / (areaHeight * areaScale),
            scale: prevState.scale,
          });
          // 提前更新 stateRef，方便在 onMoveEnd 回调中调用本组件其他使用到 stateRef 的函数
          stateRef.current = newState;
          return newState;
        });
      }
      // 执行移动结束回调
      if (
        !longPressTriggeredRef.current &&
        allowMoveRef.current &&
        onMoveEnd &&
        button === 0
      ) {
        const startX = startStateRef.current.x;
        const startY = startStateRef.current.y;
        onMoveEnd({
          ...stateRef.current,
          reset: () => {
            move({ x: startX, y: startY });
          },
        });
      }
      // 检查是否需要触发 tap 事件
      if (
        !longPressTriggeredRef.current &&
        onTap &&
        tapDelay < 500 &&
        (distance < 5 || button !== 0)
      ) {
        // 计算 tap 位置
        let tapX =
          (startMoveInfoRef.current.clientX -
            startStateRef.current.x * (areaWidth * areaScale)) /
          (sizeRef.current.width * startStateRef.current.scale);
        let tapY =
          (startMoveInfoRef.current.clientY -
            startStateRef.current.y * (areaHeight * areaScale)) /
          (sizeRef.current.height * startStateRef.current.scale);
        // 限制点击范围（触摸屏的点击位置可能在元素外，造成大于 1 或者小于 0 的坐标）
        if (tapX > 1) tapX = 1;
        if (tapY > 1) tapY = 1;
        if (tapX < 0) tapX = 0;
        if (tapY < 0) tapY = 0;
        onTap({
          x: tapX,
          y: tapY,
          button: button,
        });
      }
    } else if (size(pointersRef.current) === 1) {
      // 抬起后剩1个，缩放结束，开始移动
      movingRef.current = true;
      zoomingRef.current = false;
      // 调用结束缩放回调
      if (allowZoom && onZoomEnd) {
        onZoomEnd(stateRef.current);
      }
      // 更新初始移动状态
      for (const id in pointersRef.current) {
        startMoveInfoRef.current = {
          ...pointersRef.current[id],
        };
      }
    } else if (size(pointersRef.current) === 2) {
      // 抬起后剩2个，开始移动和缩放
      movingRef.current = true;
      zoomingRef.current = true;
      // 调用开始缩放回调
      if (allowZoom && onZoomStart) {
        onZoomStart(stateRef.current);
      }
      // 更新初始缩放状态
      startZoomInfoRef.current = getTwoPointersInfo();
    }
    // 更新组件初始 state
    startStateRef.current = stateRef.current;
  }

  /**
   * ================ 🔥Pointer 事件处理 ================
   */

  /**
   * 处理按下
   */
  function handlePointerDown(e: React.PointerEvent): void {
    e.stopPropagation();
    handleDown({
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      button: e.button, // onLongPress 用于区分左右键
    });
    // 1个光标按下，开始监听
    if (size(pointersRef.current) === 1) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    }
  }

  /**
   * 处理移动
   */
  function handlePointerMove(e: PointerEvent): void {
    e.stopPropagation();
    handleMove({
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  }

  /**
   * 处理光标抬起
   */
  function handlePointerUp(e: PointerEvent): void {
    e.stopPropagation();
    handleUp({
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      button: e.button, // onTap 用于区分左右键
    });
    // 没有光标了，取消监听（必须在 handleUp 后取消，因为在它里面增减了光标计数）
    if (size(pointersRef.current) === 0) {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    }
  }

  // 限制区域
  function limitPosition(prevState: MovableItemState): MovableItemState {
    // 拷贝对象，防止影响原对象参数
    const newState = { ...prevState };
    // 限制右/下坐标百分比
    let limitRightX = 1;
    let limitBottomY = 1;
    // 如果限制包括自身尺寸，则减去自身尺寸所占百分比
    if (limitWithSize) {
      const widthPercent = (getSize().width * newState.scale) / areaWidth;
      const heightPercent = (getSize().height * newState.scale) / areaHeight;
      limitRightX -= widthPercent;
      limitBottomY -= heightPercent;
    }
    if (newState.x > limitRightX) newState.x = limitRightX;
    if (newState.x < 0) newState.x = 0;
    if (newState.y > limitBottomY) newState.y = limitBottomY;
    if (newState.y < 0) newState.y = 0;
    return newState;
  }

  // 处理移动区域大小变化
  function handleAreaResize(): void {
    // 限制移动范围，防止浏览器缩小后，限制在范围内（包含自身大小）的 Item 部分区域看不见了
    if (limitInArea && limitWithSize && limitWithSizeOnAreaResize) {
      setState((prevState) => {
        const newState = limitPosition(prevState);
        return newState;
      });
    }
  }
  useEffect(() => {
    handleAreaResize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaWidth, areaHeight]);

  const transform = () => {
    return {
      transform: `matrix(${state.scale}, 0, 0, ${state.scale}, ${
        areaWidth * state.x
      }, ${areaHeight * state.y})`,
    };
  };

  const movableInfo = {
    area: {
      width: areaWidth,
      height: areaHeight,
      scale: areaScale,
    },
    item: {
      focus,
      allowZoom,
      allowMove,
      ...state,
    },
  };

  return (
    <div
      css={css`
        z-index: ${layer === 'auto' ? '2' : layer === 'front' ? '5' : '1'};
        position: absolute;
        top: 0;
        left: 0;
        user-select: none;
        /* 用于阻止浏览器触屏的默认的移动、双指缩放页面等手势 */
        touch-action: none;
        transform-origin: top left;
        cursor: ${allowMove ? 'grab' : 'auto'};
        &:active {
          cursor: ${allowMove ? 'grabbing' : 'auto'};
        }
        ${focus &&
        layer === 'auto' &&
        css`
          z-index: 3;
        `};
        @media (pointer: fine) {
          &:hover {
            ${layer === 'auto' &&
            css`
              z-index: 4;
            `};
          }
        }
      `}
      onPointerDown={handlePointerDown}
      onWheel={handleWheel}
      style={{
        transition,
        ...transform(),
        ...otherStyle,
      }}
      touch-action="none"
      ref={domRef}
      {...otherProps}
    >
      <MovableInfoContext.Provider value={movableInfo}>
        {children}
      </MovableInfoContext.Provider>
    </div>
  );
};

// 将 ref 传递到
export const MovableItem = forwardRef(MovableItemWithoutRef);
