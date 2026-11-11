"""Versioned little-endian render chunks. Checking never uses float32 render data."""
import array
import hashlib
import json
import pathlib
import struct
import sys

VERSION = 4
SETTINGS = "world-metres;float32-relative;uint32-local;chunk-256;indexed-content-v4;surface-styles"


def raw_array(kind, values):
    data = array.array(kind, values)
    if sys.byteorder != "little":
        data.byteswap()
    return data.tobytes()


class ChunkWriter:
    def __init__(self, store, model_id, engine):
        self.store, self.model_id = pathlib.Path(store), model_id
        self.tag=hashlib.sha256((engine+SETTINGS).encode()).hexdigest()[:10]
        self.origin = None
        self.vertices, self.indices, self.entries = [], [], []
        self.assets = []

    def add(self, element, vertices, indices):
        if self.origin is None:
            self.origin = vertices[:3]
        if self.entries and (len(self.entries) >= 256 or (len(self.vertices)+len(self.indices)+len(vertices)+len(indices))*4 > 4*1024*1024):
            self.flush()
        descriptor = {"assetIndex":len(self.assets),
            "vertexOffset": len(self.vertices), "vertexCount": len(vertices),
            "indexOffset": len(self.indices), "indexCount": len(indices)}
        self.vertices.extend(value-self.origin[i%3] for i,value in enumerate(vertices))
        self.indices.extend(indices)
        element["geometry"] = descriptor
        element["triangleCount"] = len(indices)//3
        self.entries.append(element)

    def flush(self):
        if not self.entries:
            return
        binary = struct.pack("<4sIII", b"QBM1", 1, len(self.vertices), len(self.indices)) + raw_array("f",self.vertices) + raw_array("I",self.indices)
        digest=hashlib.sha256(binary).hexdigest()
        name=f"g-{digest[:24]}.qmesh"
        asset_id=f"{self.model_id}-{digest}"
        staging = self.store/(name+".staging")
        staging.write_bytes(binary)
        staging.replace(self.store/name)
        self.assets.append({"id":asset_id,"file":name,"bytes":len(binary),"sha256":digest})
        self.vertices,self.indices,self.entries=[],[],[]

    def finish(self):
        self.flush()
        return self.assets


def cache_valid(result, store, engine, preview_version=VERSION):
    if result.get("cacheVersion")!=preview_version or result.get("engineVersion")!=engine or result.get("geometrySettings")!=SETTINGS:
        return False
    for asset in result["model"].get("geometryAssets",[]):
        path=pathlib.Path(store)/asset["file"]
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=asset["sha256"]:
            return False
    return True


def decode_element(result, element, store):
    """Test/fixture utility only; runtime Viewer uses zero-copy typed-array views."""
    descriptor=element["geometry"]
    asset=result["model"]["geometryAssets"][descriptor["assetIndex"]]
    data=(pathlib.Path(store)/asset["file"]).read_bytes()
    magic,version,nv,ni=struct.unpack_from("<4sIII",data)
    if magic!=b"QBM1" or version!=1 or len(data)!=16+4*(nv+ni):
        raise ValueError("Invalid geometry chunk")
    positions=list(struct.unpack_from(f'<{descriptor["vertexCount"]}f',data,16+4*descriptor["vertexOffset"]))
    origin=result["model"]["renderOrigin"]
    positions=[v+origin[i%3] for i,v in enumerate(positions)]
    indices=list(struct.unpack_from(f'<{descriptor["indexCount"]}I',data,16+4*(nv+descriptor["indexOffset"])))
    return positions,indices
