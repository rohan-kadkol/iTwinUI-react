/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from 'react';
import cx from 'classnames';
import { Input, InputProps } from '../Input';
import { Menu, MenuExtraContent, MenuItem } from '../Menu';
import { SelectOption } from '../Select';
import { Text } from '../Typography';
import {
  InputContainer,
  useTheme,
  Popover,
  PopoverProps,
  CommonProps,
  getRandomValue,
  InputContainerProps,
  mergeRefs,
  useVirtualization,
  VirtualScrollProps,
} from '../utils';
import SvgCaretDownSmall from '@itwin/itwinui-icons-react/cjs/icons/CaretDownSmall';
import 'tippy.js/animations/shift-away.css';
import { StatusMessage } from '../StatusMessage';

type VirtualComboboxMenuProps = {
  id: string;
} & VirtualScrollProps;

const VirtualComboboxMenu = ({ id, ...props }: VirtualComboboxMenuProps) => {
  const { outerProps, innerProps, visibleChildren } = useVirtualization(props);

  return (
    <div {...outerProps}>
      <Menu id={`${id}-list`} role='listbox' setFocus={false} {...innerProps}>
        {visibleChildren}
      </Menu>
    </div>
  );
};

export type ComboBoxProps<T> = {
  /**
   * Array of options that populate the dropdown list.
   */
  options: SelectOption<T>[];
  /**
   * Controlled value of ComboBox.
   */
  value?: T;
  /**
   * Message shown below the combobox.
   * Use `StatusMessage` component.
   */
  message?: React.ReactNode;
  /**
   * Callback fired when selected value changes.
   */
  onChange?: (value: T) => void;
  /**
   * Function to customize the default filtering logic.
   */
  filterFunction?: (
    options: SelectOption<T>[],
    inputValue: string,
  ) => SelectOption<T>[];
  /**
   * Native input element props.
   */
  inputProps?: Omit<InputProps, 'setFocus'>;
  /**
   * Props to customize dropdown menu behavior.
   */
  dropdownMenuProps?: PopoverProps;
  /**
   * Message shown when no options are available.
   * @default 'No options found'
   */
  emptyStateMessage?: string;
  /**
   * A custom item renderer can be specified to control the rendering.
   * This function should ideally return a customized version of `MenuItem`,
   * otherwise you will need to make sure to provide styling for the `isFocused` state.
   */
  itemRenderer?: (
    option: SelectOption<T>,
    states: {
      isSelected: boolean;
      isFocused: boolean;
      id: string;
      index: number;
    },
  ) => JSX.Element;
  /**
   * Virtualization is used for the scrollable dropdown list.
   * Use it if you expect a very long list of items.
   * @default false
   * @beta
   */
  enableVirtualization?: boolean;
} & Pick<InputContainerProps, 'status'> &
  Omit<CommonProps, 'title'>;

type ExtendedSelectOption<T> = SelectOption<T> & { id: string; index: number };

/**
 * ComboBox component that allows typing a value to filter the options in dropdown list.
 * Values can be selected either using mouse clicks or using the Enter key.
 * @example
 * <ComboBox
 *   options={[
 *     { label: 'Item 1', value: 1 },
 *     { label: 'Item 2', value: 2 },
 *     { label: 'Item 3', value: 3 },
 *   ]}
 *   onChange={() => {}}
 * />
 */
export const ComboBox = <T,>(props: ComboBoxProps<T>) => {
  const {
    options,
    value,
    onChange,
    filterFunction,
    className,
    inputProps,
    dropdownMenuProps,
    message,
    status,
    emptyStateMessage = 'No options found',
    itemRenderer,
    enableVirtualization = false,
    ...rest
  } = props;

  // Generate a stateful random id if not specified
  const [id] = React.useState(
    () =>
      props.id ??
      (inputProps?.id && `${inputProps.id}-cb`) ??
      `iui-cb-${getRandomValue(10)}`,
  );

  const mapOptions = React.useCallback(() => {
    console.log('mapOptions');
    const newOptionsMap: Record<string, ExtendedSelectOption<T>> = {};
    const jsxItems: JSX.Element[] = [];
    const newOptions = options.map((option, index) => {
      const optionId = `${id}-option${index}`;
      const newOption = {
        ...option,
        id: option.id ?? optionId,
        index,
      };
      newOptionsMap[newOption.id] = newOption;
      const { label, value, ...rest } = option;
      const additionalProps = {
        value: value,
        role: 'option',
        onClick: () => {
          setSelectedValueId(newOption.id);
          userOnChange.current?.(value);
          setIsOpen(false);
        },
      };
      if (itemRenderer) {
        jsxItems.push(
          React.cloneElement(
            itemRenderer(option, {
              id: newOption.id,
              index,
              isSelected: false,
              isFocused: false,
            }),
            additionalProps,
          ),
        );
      } else {
        jsxItems.push(
          <MenuItem key={newOption.id} {...additionalProps} {...rest}>
            {label}
          </MenuItem>,
        );
      }
      return newOption;
    });
    optionsMap.current = newOptionsMap;
    setMemoizedItems(jsxItems);
    setExtendedOriginalOptions(newOptions);
  }, [id, itemRenderer, options]);

  const [extendedOriginalOptions, setExtendedOriginalOptions] = React.useState<
    ExtendedSelectOption<T>[]
  >([]);
  const optionsMap = React.useRef<Record<string, ExtendedSelectOption<T>>>({});
  const [memoizedItems, setMemoizedItems] = React.useState<JSX.Element[]>([]);

  React.useEffect(() => {
    mapOptions();
  }, [mapOptions]);

  useTheme();

  const userOnChange = React.useRef(onChange);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const toggleButtonRef = React.useRef<HTMLSpanElement>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  // Set min-width of menu to be same as input
  const [minWidth, setMinWidth] = React.useState(0);
  React.useEffect(() => {
    if (inputRef.current) {
      setMinWidth(inputRef.current.offsetWidth);
    }
  }, [isOpen]);

  const [filteredOptions, setFilteredOptions] = React.useState<
    ExtendedSelectOption<T>[]
  >(extendedOriginalOptions);
  React.useEffect(() => {
    setFilteredOptions(extendedOriginalOptions);
  }, [extendedOriginalOptions]);

  const [focusedIndex, setFocusedIndex] = React.useState<
    ExtendedSelectOption<T> | undefined
  >(() => (selectedValueId ? optionsMap.current[selectedValueId] : undefined));

  // Maintain internal selected value state synced with `value` prop
  const [selectedValueId, setSelectedValueId] = React.useState<string>();

  React.useEffect(() => {
    setSelectedValueId(
      extendedOriginalOptions.find((option) => option.value === value)?.id,
    );
  }, [extendedOriginalOptions, value]);

  // Controlled input value
  const [inputValue, setInputValue] = React.useState<string>('');
  const onInput = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(event.target.value);
      inputProps?.onChange?.(event);
    },
    [inputProps],
  );

  // update inputValue and focusedIndex every time selected value changes
  React.useEffect(() => {
    if (!selectedValueId) {
      return;
    }
    const selectedOption = optionsMap.current[selectedValueId];
    if (!selectedOption) {
      return;
    }
    setInputValue(selectedOption.label);
    setFocusedIndex(selectedOption);
  }, [selectedValueId]);

  // Filter options and update focus when input value changes
  React.useEffect(() => {
    if (!isOpen) {
      return;
    }
    console.log('rerende ron input change');

    // if input is empty or same as selected value, show the whole list
    // const selectedOption = options.find(({ value }) => value === selectedValue);
    const selectedValue = selectedValueId
      ? optionsMap.current[selectedValueId]
      : undefined;
    if (!inputValue || selectedValue?.label === inputValue) {
      setFilteredOptions(extendedOriginalOptions);
      return;
    }

    const _filteredOptions: ExtendedSelectOption<T>[] =
      filterFunction?.(extendedOriginalOptions, inputValue).map((el) => {
        const extendedOption =
          extendedOriginalOptions.find((e) => e.value === el.value) ??
          ({} as ExtendedSelectOption<T>);
        return {
          ...el,
          ...extendedOption,
        };
      }) ??
      extendedOriginalOptions.filter((option) =>
        option.label.toLowerCase().includes(inputValue?.trim().toLowerCase()),
      );
    setFilteredOptions(_filteredOptions);

    setFocusedIndex((previouslyFocusedIndex) => {
      if (_filteredOptions.some((el) => el.id === previouslyFocusedIndex?.id)) {
        return previouslyFocusedIndex;
      } else if (
        _filteredOptions.some(({ value }) => value === selectedValue?.value)
      ) {
        return selectedValue;
      } else {
        return undefined; // reset focus if previously focused or selected value is not in filtered list
      }
    });
  }, [
    inputValue,
    selectedValueId,
    isOpen,
    filterFunction,
    extendedOriginalOptions,
  ]);

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          console.log('DOWN', isOpen);
          if (isOpen) {
            const filteredFocusedIndex = focusedIndex?.index ?? -1;
            const nextFilteredOption = filteredOptions.find(
              (option, index) =>
                index > filteredFocusedIndex && !option.disabled,
            );
            console.log(
              'down',
              filteredFocusedIndex,
              nextFilteredOption?.index,
            );
            if (nextFilteredOption) {
              setFocusedIndex(nextFilteredOption);
            }
          } else {
            setIsOpen(true); // reopen menu if closed when typing
          }
          event.preventDefault();
          event.stopPropagation();
          break;
        case 'ArrowUp':
          if (isOpen && focusedIndex) {
            const filteredFocusedIndex = focusedIndex.index;
            if (filteredFocusedIndex === 0) {
              break;
            }
            let nextFilteredOption:
              | ExtendedSelectOption<T>
              | undefined = undefined;
            for (let i = filteredFocusedIndex - 1; i >= 0; --i) {
              if (!!filteredOptions[i] && !filteredOptions[i].disabled) {
                nextFilteredOption = filteredOptions[i];
                break;
              }
            }
            console.log('up', nextFilteredOption?.index);
            if (nextFilteredOption) {
              setFocusedIndex(nextFilteredOption);
            }
          }
          event.preventDefault();
          event.stopPropagation();
          break;
        case 'Enter':
          if (isOpen && focusedIndex) {
            setSelectedValueId(focusedIndex.id);
            userOnChange.current?.(focusedIndex.value);
          }
          setIsOpen((open) => !open);
          event.preventDefault();
          event.stopPropagation();
          break;
        case 'Escape':
          setIsOpen(false);
          event.preventDefault();
          event.stopPropagation();
          break;
        case 'Tab':
          setIsOpen(false);
          break;
        default:
          if (!isOpen) {
            setIsOpen(true); // reopen menu if closed when typing
          }
          break;
      }
    },
    [isOpen, focusedIndex, filteredOptions],
  );

  const getSingleMenuItem = React.useCallback(
    (index: number) => {
      const filteredOption = filteredOptions[index];
      if (filteredOptions.length < 150) {
        console.log(index, filteredOptions);
      }
      if (!filteredOption) {
        return undefined;
      }

      const isSelected = selectedValueId === filteredOption.id;
      const isFocused = focusedIndex?.id === filteredOption.id;
      const focusScrollRef = (el: HTMLElement) => {
        if (!enableVirtualization && isFocused) {
          el?.scrollIntoView({ block: 'nearest' });
        }
      };
      const originalIndex = optionsMap.current[filteredOption.id]?.index;

      if (isSelected || isFocused) {
        const item =
          itemRenderer?.(filteredOption, {
            index: originalIndex,
            id: filteredOption.id,
            isSelected,
            isFocused,
          }) ??
          React.cloneElement(memoizedItems[originalIndex], { isSelected });

        return React.cloneElement(item, {
          className: cx({ 'iui-focused': isFocused }, item.props.className),
          ref: mergeRefs(focusScrollRef, item.props.ref),
          value: filteredOption.value,
          role: 'option',
          onClick: () => {
            setSelectedValueId(filteredOption.id);
            userOnChange.current?.(filteredOption.value);
            setIsOpen(false);
          },
        });
      }

      return memoizedItems[originalIndex];
    },
    [
      enableVirtualization,
      filteredOptions,
      focusedIndex?.id,
      itemRenderer,
      memoizedItems,
      selectedValueId,
    ],
  );

  const menuItems = React.useMemo(() => {
    if (filteredOptions.length === 0) {
      return [
        <MenuExtraContent key={0}>
          <Text isMuted>{emptyStateMessage}</Text>
        </MenuExtraContent>,
      ];
    }
    return filteredOptions.map((option, index) => getSingleMenuItem(index));
  }, [filteredOptions, emptyStateMessage, getSingleMenuItem]);

  const virtualizedItemRenderer = React.useCallback(
    (index) =>
      getSingleMenuItem(index) ?? (
        <MenuExtraContent key={0}>
          <Text isMuted>{emptyStateMessage}</Text>
        </MenuExtraContent>
      ),
    [emptyStateMessage, getSingleMenuItem],
  );

  return (
    <InputContainer
      className={className}
      status={status}
      statusMessage={
        typeof message === 'string' ? (
          <StatusMessage status={status}>{message}</StatusMessage>
        ) : (
          React.isValidElement(message) &&
          React.cloneElement(message, { status })
        )
      }
      {...rest}
      id={id}
    >
      <div className='iui-input-with-icon'>
        <Popover
          placement='bottom-start'
          visible={isOpen}
          onClickOutside={(_, { target }) => {
            if (!toggleButtonRef.current?.contains(target as Element)) {
              setIsOpen(false);
            }
          }}
          animation='shift-away'
          duration={200}
          {...dropdownMenuProps}
          content={
            <>
              {enableVirtualization ? (
                <div
                  style={{
                    minWidth,
                    maxWidth: `min(${minWidth * 2}px, 90vw)`,
                    maxHeight: 315,
                  }}
                  className='iui-menu iui-scroll'
                >
                  <VirtualComboboxMenu
                    id={`${id}-list`}
                    itemsLength={filteredOptions.length}
                    itemRenderer={virtualizedItemRenderer}
                    scrollToIndex={focusedIndex?.index}
                  />
                </div>
              ) : (
                <Menu
                  id={`${id}-list`}
                  className='iui-scroll'
                  style={{
                    minWidth,
                    maxWidth: `min(${minWidth * 2}px, 90vw)`,
                    maxHeight: 315,
                  }}
                  setFocus={false}
                  role='listbox'
                >
                  {menuItems}
                </Menu>
              )}
            </>
          }
          onHide={(instance) => {
            const selectedIndex = selectedValueId
              ? optionsMap.current[selectedValueId]
              : undefined;
            setFocusedIndex(selectedIndex);
            if (selectedIndex) {
              setInputValue(selectedIndex.label); // update input value to be same as selected value
            }
            dropdownMenuProps?.onHide?.(instance);
          }}
        >
          <Input
            ref={inputRef}
            onKeyDown={onKeyDown}
            onFocus={() => setIsOpen(true)}
            value={inputValue}
            aria-activedescendant={
              isOpen && focusedIndex ? focusedIndex.id : undefined
            }
            role='combobox'
            aria-controls={isOpen ? `${id}-list` : undefined}
            aria-autocomplete='list'
            spellCheck={false}
            autoCapitalize='none'
            autoCorrect='off'
            {...inputProps}
            onChange={onInput}
          />
        </Popover>
        <span
          ref={toggleButtonRef}
          className={cx('iui-end-icon', {
            'iui-actionable': !inputProps?.disabled,
            'iui-disabled': inputProps?.disabled,
            'iui-open': isOpen,
          })}
          onClick={() => {
            if (isOpen) {
              setIsOpen(false);
            } else {
              inputRef.current?.focus();
            }
          }}
        >
          <SvgCaretDownSmall aria-hidden />
        </span>
      </div>
    </InputContainer>
  );
};

export default ComboBox;
