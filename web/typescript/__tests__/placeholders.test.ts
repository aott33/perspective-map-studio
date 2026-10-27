import { ItemView, fill, isAssetRelative } from '../placeholders';

// The same vectors as common/src/test/.../PlaceholdersTest.java.
const P12: ItemView = {
    itemId: '4f6c', itemName: 'P12', assetId: 'P12', assetPath: '[default]Mesa/P12',
    properties: { operator: 'Acme', wells: 12, note: null }
};
const NO_ASSET: ItemView = { itemId: '9a1b', itemName: 'Line 3', assetId: null, assetPath: null, properties: {} };

describe('fill', () => {
    test('resolves the asset path and every placeholder', () => {
        expect(fill('{asset.path}/Pressure', P12)).toBe('[default]Mesa/P12/Pressure');
        expect(fill('{asset.path}', P12)).toBe('[default]Mesa/P12');
        expect(fill('/pad/{item.name}', P12)).toBe('/pad/P12');
        expect(fill('{item.id} {item.name} {asset.id} {item.properties.operator} {item.properties.wells}', P12))
            .toBe('4f6c P12 P12 Acme 12');
        expect(fill('Mesa', P12)).toBe('Mesa');
    });

    test('a placeholder with no value gives null', () => {
        expect(fill('{asset.path}/Pressure', NO_ASSET)).toBeNull();
        expect(fill('{asset.id}', NO_ASSET)).toBeNull();
        expect(fill('{item.properties.note}', P12)).toBeNull();
        expect(fill('{item.properties.missing}', P12)).toBeNull();
        expect(fill('{item.foo}', P12)).toBeNull();
        expect(fill('{item.name', P12)).toBeNull();
        expect(fill(null, P12)).toBeNull();
    });
});

describe('isAssetRelative', () => {
    test('is {asset.path}/ and a tag path', () => {
        expect(isAssetRelative('{asset.path}/Comms')).toBe(true);
        expect(isAssetRelative('{asset.path}')).toBe(false);
        expect(isAssetRelative('{asset.path}/')).toBe(false);
        expect(isAssetRelative('{asset.path}/{item.name}')).toBe(false);
        expect(isAssetRelative('[default]Shared/GasPrice')).toBe(false);
    });
});
