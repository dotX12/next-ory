import { UiNode, UiNodeImageAttributes } from '@ory/client';
import Image from 'next/image';

interface Props {
    node: UiNode;
    attributes: UiNodeImageAttributes;
}

export const NodeImage = ({ node, attributes }: Props) => {
    return (
        <img
            src={attributes.src}
            width={200}
            alt={node.meta.label?.text || 'Image'}
        />
    );
};
