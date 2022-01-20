/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from 'react';
import { CommonProps, useTheme } from '../utils';
import '@itwin/itwinui-css/css/tree.css';
import cx from 'classnames';

export const TreeContext = React.createContext<
  | {
      nodeDepth?: number;
    }
  | undefined
>(undefined);

export type NodeData<T> = {
  subNodes?: Array<T>;
  nodeId: string;
  node: T;
  isExpanded?: boolean;
  isDisabled?: boolean;
  depth?: number;
};

export type TreeProps<T> = {
  /**
   * Node renderer.
   */
  nodeRenderer: (props: NodeData<T>) => JSX.Element;
  /**
   * Items inside tree.
   */
  data: T[];
  /**
   * Get the NodeData.
   */
  getNode: (node: T) => NodeData<T>;
} & CommonProps;

/**
 * @example
  <Tree
    nodeCount={50}
    getNode={getNode}
    nodeRenderer={(props) => (
      <TreeNode
        nodeId={props.nodeId}
        label={props.label}
        sublabel={props.subLabel}
        subNodes={props.subnodes}
        onNodeExpanded={onNodeExpanded}
        onNodeSelected={onSelectedNodeChange}
        isDisabled={props.isDisabled}
        isExpanded={props.isExpanded}
        nodeCheckbox={<Checkbox variant='eyeball' checked={true} />}
        icon={<SvgPlaceholder />}
      />
    )}
    selectedNodes={selectedNodes}
    {...args}
  />
 */
export const Tree = <T,>(props: TreeProps<T>) => {
  const { data, className, nodeRenderer, getNode, ...rest } = props;
  useTheme();

  const treeRef = React.useRef<HTMLUListElement>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    const nodes: Array<HTMLElement> = Array.from(
      treeRef.current?.querySelectorAll('.iui-tree-node:not(.iui-disabled)') ||
        [],
    );

    if (!nodes.length) {
      return;
    }

    let newIndex = -1;
    const currentIndex = nodes.findIndex(
      (node) => node === treeRef.current?.ownerDocument.activeElement,
    );

    const expander = nodes[currentIndex].querySelector(
      '.iui-tree-node-content-expander-icon',
    ) as HTMLElement;

    switch (event.key) {
      case 'ArrowDown': {
        newIndex = currentIndex + 1;
        break;
      }
      case 'ArrowUp': {
        newIndex = currentIndex - 1;
        break;
      }
      case 'ArrowLeft':
        if (
          expander === null ||
          !expander?.classList.contains(
            'iui-tree-node-content-expander-icon-expanded',
          )
        ) {
          let parentIndex = -1;
          for (let n = 0; n < nodes.length; n++) {
            const parentOwns = (nodes[n].parentElement
              ?.lastChild as HTMLElement)
              .getAttribute('aria-owns')
              ?.split(', ');
            if (
              parentOwns &&
              parentOwns?.findIndex(
                (id) => id === nodes[currentIndex].parentElement?.id,
              ) != -1
            ) {
              parentIndex = n;
              break;
            }
          }
          if (parentIndex != -1) {
            newIndex = parentIndex;
          } else {
            newIndex = currentIndex - 1;
          }
        } else {
          expander.parentElement?.click();
        }
        break;
      case 'ArrowRight':
        if (
          expander === null ||
          expander?.classList.contains(
            'iui-tree-node-content-expander-icon-expanded',
          )
        ) {
          newIndex = currentIndex + 1;
        } else {
          expander.parentElement?.click();
          return;
        }
        break;
      case 'Enter':
      case ' ':
      case 'Spacebar':
        nodes[currentIndex].click();
        event.preventDefault();
        return;
    }

    if (newIndex >= 0 && newIndex < nodes.length) {
      nodes[newIndex].focus();
      event.preventDefault();
    }
  };

  const flatNodesList = React.useMemo(() => {
    const flatList: NodeData<T>[] = [];

    const addSubNodes = (element: T, depth: number) => {
      const flatNode = getNode(element);
      flatNode.depth = depth;
      flatList.push(flatNode);
      if (flatNode.isExpanded) {
        flatNode.subNodes?.forEach((subNode) => {
          addSubNodes(subNode, depth + 1);
        });
      }
    };

    data.forEach((element) => {
      addSubNodes(element, 0);
    });

    return flatList;
  }, [data, getNode]);

  return (
    <ul
      className={cx('iui-tree', className)}
      role='tree'
      onKeyDown={handleKeyDown}
      ref={treeRef}
      {...rest}
    >
      {flatNodesList.map((flatNode) => (
        <React.Fragment key={flatNode.nodeId}>
          <TreeContext.Provider
            value={{
              // selectedNodes: selectedNodes ?? selected,
              // setSelectedNode: selectedNodes ? undefined : setSelected,
              nodeDepth: flatNode.depth,
            }}
          >
            {nodeRenderer(flatNode)}
          </TreeContext.Provider>
        </React.Fragment>
      ))}
    </ul>
  );
};

export default Tree;
